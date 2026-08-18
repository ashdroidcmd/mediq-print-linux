#!/usr/bin/env node
/**
 * EPSON TM-T82II Print Server for Ubuntu Linux
 *
 * Express.js backend service for thermal printer queue management.
 * USB-only: talks to the printer through the kernel's usblp device node
 * (e.g. /dev/usb/lp0). No network/TCP printing path.
 *
 * Installation:
 *   npm install
 *
 * Usage:
 *   npm run server              # Start server
 *   npm run server:dev          # Start with debug output
 *
 * Server runs on http://localhost:3002
 *
 * --- CHANGELOG (detection hardening) ---
 * - Detection now confirms the actual Epson vendor/product ID via sysfs
 *   instead of trusting that any /dev/usb/lpN file existing means the right
 *   printer is attached. Falls back to old file-existence probing if sysfs
 *   isn't available (e.g. minimal containers).
 * - Detection re-runs on every check (unless the device path is pinned via
 *   env var or a manual /config call) instead of only running once at
 *   process start, so replugging into a different port is picked up
 *   without a server restart.
 * - Closed a shell-injection hole: the sudo fallback used to build a shell
 *   string with the (user-configurable, via POST /config) device path
 *   interpolated directly into execSync(). Now validated against a strict
 *   pattern and passed as an argv array via spawnSync (no shell involved).
 * - Removed the unused busy-wait sleep() helper and the entire TCP/network
 *   printing path (dead code for a USB-only deployment, and one less thing
 *   POST /config could be used to misconfigure).
 */
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const { execSync, spawnSync } = require("child_process");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3002;
const DEBUG = process.argv.includes("--debug") || process.env.DEBUG === "true";
// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
// Logger
const log = (message, isDebug = false) => {
  if (isDebug && !DEBUG) return;
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  console.log(`[${timestamp}] ${message}`);
};
// ESC/POS Commands
const ESC = "\x1B";
const GS = "\x1D";
const LF = "\x0A";

// --- USB identity + path validation -----------------------------------

// EPSON's registered USB vendor ID. Confirmed constant across their printer line.
const EPSON_VENDOR_ID = "04b8";
// NOTE: I could not verify the TM-T82II's exact USB product ID against your
// hardware. 0e15 is the commonly reported ID for TM-T82II; 0202 is included
// as a fallback seen on some TM-T82 firmware/interface modes. Confirm the
// real value via GET /debug/devices (lsusb output) and adjust this list.
const EPSON_TMT82II_PRODUCT_IDS = ["0e15", "0202"];

// Kernel exposes usblp-bound devices under one of these class directories
// depending on version. We check both.
const USB_LP_CLASS_DIRS = ["/sys/class/usbmisc", "/sys/class/usb"];

// Only ever accept paths shaped like a real Linux printer device node.
// This is what stands between a POST /config call and a shell command.
const USB_DEVICE_PATTERN = /^\/dev\/(usb\/lp|lp)\d+$/;

function isValidUsbDevicePath(devicePath) {
  return typeof devicePath === "string" && USB_DEVICE_PATTERN.test(devicePath);
}

/**
 * Walk sysfs looking for a usblp device node whose USB vendor/product ID
 * matches the Epson TM-T82II. This is what actually confirms "this is our
 * printer," as opposed to "some file exists at a path we guessed."
 */
function findEpsonUsbDevice() {
  for (const classDir of USB_LP_CLASS_DIRS) {
    let candidates;
    try {
      candidates = fs.readdirSync(classDir).filter((d) => /^lp\d+$/.test(d));
    } catch {
      continue; // this class path doesn't exist on this kernel — try the next
    }
    for (const name of candidates) {
      try {
        const deviceDir = path.join(
          fs.realpathSync(path.join(classDir, name, "device")),
          "..",
        );
        const vendorId = fs
          .readFileSync(path.join(deviceDir, "idVendor"), "utf-8")
          .trim();
        const productId = fs
          .readFileSync(path.join(deviceDir, "idProduct"), "utf-8")
          .trim();
        if (
          vendorId === EPSON_VENDOR_ID &&
          EPSON_TMT82II_PRODUCT_IDS.includes(productId)
        ) {
          return `/dev/usb/${name}`;
        }
      } catch {
        continue; // this node's sysfs layout didn't match what we expected — skip it
      }
    }
  }
  return null;
}

function detectUsbPrinter() {
  const confirmed = findEpsonUsbDevice();
  if (confirmed) return confirmed;

  // Fall back to old path-existence probing if identity confirmation failed
  // (e.g. sysfs class dirs missing in a minimal container). Less reliable —
  // logged as a warning so it's visible in ops output.
  const fallbackDevices = [
    "/dev/usb/lp0",
    "/dev/usb/lp1",
    "/dev/usb/lp2",
    "/dev/usb/lp3",
    "/dev/usb/lp4",
  ];
  for (const device of fallbackDevices) {
    if (fs.existsSync(device)) {
      log(
        `⚠ Using unverified USB device ${device} (could not confirm Epson vendor ID via sysfs)`,
        false,
      );
      return device;
    }
  }
  return null;
}

const printerConfig = {
  usbDevice: process.env.USB_DEVICE_PATH || detectUsbPrinter(),
  name: "EPSON TM-T82II",
  model: "TM-T82II",
  paperWidth: 80,
  // If the USB path was pinned via env var or an explicit POST /config call,
  // stop auto-re-detecting over it — the operator asked for that exact path.
  usbDeviceLocked: Boolean(process.env.USB_DEVICE_PATH),
};

/**
 * Re-run USB detection unless the path has been explicitly pinned.
 * Called on every USB check so hot-plug / port changes are picked up
 * without requiring a server restart.
 */
function refreshUsbDetection() {
  if (printerConfig.usbDeviceLocked) return printerConfig.usbDevice;
  const detected = detectUsbPrinter();
  if (detected !== printerConfig.usbDevice) {
    log(
      `USB device path changed: ${printerConfig.usbDevice || "(none)"} → ${
        detected || "(none)"
      }`,
    );
    printerConfig.usbDevice = detected;
  }
  return printerConfig.usbDevice;
}

/**
 * Helper: Check if USB device is available.
 * Re-detects first (unless locked), then confirms the resulting path
 * both matches the expected shape and exists on disk.
 */
function checkUSBDevice() {
  const devicePath = refreshUsbDetection();
  if (!isValidUsbDevicePath(devicePath)) return false;
  try {
    fs.statSync(devicePath);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Generate ESC/POS receipt buffer
 */
function generateReceipt(
  queueNumber,
  departmentName,
  serviceName,
  priorityName,
  timestamp,
) {
  let receipt = "";
  // Initialize printer
  receipt += ESC + "@";
  receipt += LF;
  // Set center alignment
  receipt += ESC + "a\x01";
  // Title (bold, 2x height)
  receipt += ESC + "E\x01";
  receipt += ESC + "i\x00\x01";
  receipt += "Your Queue Number Is" + LF + LF;
  // Large queue number (use character size magnification)
  receipt += GS + "!" + "\x33"; // 4x4
  receipt += queueNumber + LF;
  // Reset size
  receipt += ESC + "!" + "\x00";
  receipt += ESC + "E\x00"; // Bold off
  receipt += "\n";
  // Department and service (bold)
  receipt += ESC + "E\x01"; // Bold on
  receipt += GS + "!" + "\x11"; // 2x2
  receipt += departmentName + LF;
  receipt += ESC + "E\x00"; // Bold off
  receipt += ESC + "!" + "\x00"; // Reset size
  // Message (center)
  receipt += ESC + "a\x01";
  receipt += LF;
  // Add timestamp (normal size, centered)
  receipt += LF;
  if (timestamp) {
    const date = new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const time = new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: true,
    });
    receipt += date + LF;
    receipt += time + LF;
  }
  // Message (center)
  receipt += ESC + "a\x01";
  receipt += LF;
  receipt += ESC + "E\x01";
  receipt += "Wait for your call" + LF;
  receipt += ESC + "E\x00";
  // Spacing
  receipt += LF + LF + LF + LF;
  // Cut paper
  receipt += GS + "V\x42\x00"; // Partial cut
  return Buffer.from(receipt, "binary");
}

/**
 * Print via USB device
 */
function printUSB(data) {
  return new Promise((resolve, reject) => {
    if (!checkUSBDevice()) {
      return reject(
        new Error(
          `USB printer not found${printerConfig.usbDevice ? ` at ${printerConfig.usbDevice}` : ""}`,
        ),
      );
    }
    try {
      fs.writeFileSync(printerConfig.usbDevice, data);
      log(`✓ Data written to ${printerConfig.usbDevice}`);
      resolve({ method: "usb", device: printerConfig.usbDevice });
    } catch (error) {
      if (error.code === "EACCES") {
        log(
          "USB write failed (permission denied), attempting with sudo...",
          true,
        );
        try {
          // spawnSync with an argv array — no shell string interpolation,
          // so a crafted device path can't break out into arbitrary
          // commands. Data is piped via stdin, no temp file needed.
          const result = spawnSync("sudo", ["tee", printerConfig.usbDevice], {
            input: data,
            stdio: ["pipe", "ignore", "pipe"],
          });
          if (result.error) throw result.error;
          if (result.status !== 0) {
            throw new Error(
              result.stderr?.toString() ||
                `sudo tee exited with code ${result.status}`,
            );
          }
          log(`✓ Data written to ${printerConfig.usbDevice} (via sudo)`);
          resolve({
            method: "usb",
            device: printerConfig.usbDevice,
            sudo: true,
          });
        } catch (sudoError) {
          reject(new Error(`USB write failed: ${sudoError.message}`));
        }
      } else {
        reject(new Error(`USB write failed: ${error.message}`));
      }
    }
  });
}

/**
 * GET /health - Health check
 */
app.get("/health", (req, res) => {
  try {
    const usbAvailable = checkUSBDevice();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      printer: {
        name: printerConfig.name,
        model: printerConfig.model,
        detected: usbAvailable,
        connection: {
          type: "usb",
          available: usbAvailable,
          device: printerConfig.usbDevice,
          identityConfirmed: Boolean(findEpsonUsbDevice()),
          locked: printerConfig.usbDeviceLocked,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /printers - List available printers
 */
app.get("/printers", (req, res) => {
  try {
    const usbAvailable = checkUSBDevice();
    res.json({
      available: usbAvailable,
      printer: printerConfig.name,
      connection: usbAvailable
        ? `${printerConfig.usbDevice} (available)`
        : `${printerConfig.usbDevice || "(none detected)"} (not found)`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /config - Get current configuration
 */
app.get("/config", (req, res) => {
  res.json({
    printer: printerConfig,
    environment: {
      port: PORT,
      debug: DEBUG,
      nodeVersion: process.version,
      platform: process.platform,
    },
  });
});

/**
 * POST /config - Update configuration
 */
app.post("/config", (req, res) => {
  try {
    const { usbDevice } = req.body;
    if (usbDevice === "auto") {
      // Explicit escape hatch: un-pin a previously locked path and go back
      // to auto re-detecting on every check.
      printerConfig.usbDeviceLocked = false;
      printerConfig.usbDevice = detectUsbPrinter();
    } else if (usbDevice) {
      if (!isValidUsbDevicePath(usbDevice)) {
        return res.status(400).json({
          error: `Invalid USB device path. Expected e.g. /dev/usb/lp0, or "auto" to un-pin, got: ${usbDevice}`,
        });
      }
      printerConfig.usbDevice = usbDevice;
      printerConfig.usbDeviceLocked = true; // operator pinned it explicitly — stop auto re-detecting over it
    }
    log(`Configuration updated: ${JSON.stringify(printerConfig)}`);
    res.json({
      success: true,
      config: printerConfig,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /debug/devices - List USB devices
 */
app.get("/debug/devices", (req, res) => {
  try {
    let output;
    try {
      output = execSync("lsusb", { encoding: "utf-8" });
    } catch (e) {
      output = "lsusb command not available";
    }
    const lines = output
      .split("\n")
      .filter((l) => l.includes("Epson") || l.includes("04b8"));
    res.json({
      found: lines.length > 0,
      epsonDevices: lines,
      allDevices: output.split("\n").length,
      hint: "Look for vendor ID 04b8 (Epson). Confirm the exact product ID here and update EPSON_TMT82II_PRODUCT_IDS in the source if it differs.",
      usbDeviceFiles: {
        typical: ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/lp0", "/dev/lp1"],
        current: printerConfig.usbDevice,
        exists: checkUSBDevice(),
        identityConfirmedViaSysfs: Boolean(findEpsonUsbDevice()),
        locked: printerConfig.usbDeviceLocked,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /debug/cups - List CUPS printers
 */
app.get("/debug/cups", (req, res) => {
  try {
    let output;
    try {
      output = execSync("lpstat -p -d", { encoding: "utf-8" });
    } catch (e) {
      output = "lpstat command not available or CUPS not installed";
    }
    res.json({
      cupsPrinters: output.split("\n").filter((l) => l.trim()),
      command: "lpstat -p -d",
      note: "This shows CUPS-managed printers. For direct USB, use /dev/usb/lp0 instead.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /print - Print queue ticket
 */
app.post("/print", async (req, res) => {
  try {
    const {
      queueNumber,
      departmentName,
      serviceName,
      priorityName,
      timestamp,
    } = req.body;
    // Validation
    if (!queueNumber || !departmentName || !serviceName) {
      return res.status(400).json({
        error:
          "Missing required fields: queueNumber, departmentName, serviceName",
      });
    }
    log(
      `📋 Print request: ${queueNumber} (${departmentName} - ${serviceName})`,
    );
    // Generate receipt
    const receiptData = generateReceipt(
      queueNumber,
      departmentName,
      serviceName,
      priorityName,
      timestamp,
    );
    log(`Generated receipt: ${receiptData.length} bytes`, true);
    // Print
    const result = await printUSB(receiptData);
    log(`✓ Ticket ${queueNumber} printed via ${result.method}`);
    res.json({
      success: true,
      ticketNumber: queueNumber,
      method: result.method,
      bytes: receiptData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log(`✗ Print error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      troubleshooting: [
        "Check printer is powered on",
        "Verify USB cable is connected",
        "Run: GET /debug/devices (to see available printers)",
        "Check permissions: ls -la /dev/usb/lp*",
        "May need to run with sudo or add user to lpadmin group",
      ],
    });
  }
});

/**
 * POST /test-print - Test print
 */
app.post("/test-print", async (req, res) => {
  try {
    log("🧪 Test print requested");
    const receiptData = generateReceipt(
      "TEST-001",
      "TEST DEPARTMENT",
      "TEST SERVICE",
      "Normal",
      new Date().toLocaleString(),
    );
    const result = await printUSB(receiptData);
    log(`✓ Test print successful via ${result.method}`);
    res.json({
      success: true,
      message: "Test print successful",
      method: result.method,
      bytes: receiptData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log(`✗ Test print error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  log(`Unhandled error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: DEBUG ? err.message : undefined,
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║    EPSON TM-T82II Print Server - Ubuntu Linux (USB only)      ║
║    Running on http://localhost:${PORT}                           ║
╚════════════════════════════════════════════════════════════════╝
API Endpoints:
  GET  /health              - Server health & printer status
  GET  /printers            - List available printers
  GET  /config              - Show current configuration
  POST /config              - Update configuration
  POST /print               - Print queue ticket
  POST /test-print          - Test print
Debug Endpoints:
  GET  /debug/devices       - List USB devices (lsusb + sysfs identity check)
  GET  /debug/cups          - List CUPS printers
Configuration:
  Port: ${PORT}
  USB Device: ${printerConfig.usbDevice}
Example Usage:
  # Health check
  curl http://localhost:${PORT}/health
  # List printers
  curl http://localhost:${PORT}/printers
  # Print ticket
  curl -X POST http://localhost:${PORT}/print \\
    -H "Content-Type: application/json" \\
    -d '{
      "queueNumber": "A01",
      "departmentName": "Registration",
      "serviceName": "General Checkup",
      "priorityName": "Normal"
    }'
Environment Variables:
  PORT              - Server port (default: 3002)
  USB_DEVICE_PATH   - USB device path (auto-detected if unset)
  DEBUG             - Enable debug logging (default: false)
For troubleshooting, run:
  npm run detect    - Detect connected printers
  npm run server:dev - Start with debug output
  `);
  // Auto-detect printer
  const usbAvailable = checkUSBDevice();
  if (usbAvailable) {
    log(`✓ USB printer detected at ${printerConfig.usbDevice}`, false);
  } else {
    log(`✗ USB printer not found`, false);
  }
});
