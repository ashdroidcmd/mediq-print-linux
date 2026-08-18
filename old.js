#!/usr/bin/env node

/**
 * EPSON TM-T82II Print Server for Ubuntu Linux
 *
 * Express.js backend service for thermal printer queue management
 * Uses native Linux device files (no external USB library dependency)
 *
 * Installation:
 *   npm install
 *
 * Usage:
 *   npm run server              # Start server
 *   npm run server:dev          # Start with debug output
 *
 * Server runs on http://localhost:3002
 */

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const net = require("net");
const { execSync } = require("child_process");
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

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function detectUsbPrinter() {
  const devices = [
    "/dev/usb/lp0",
    "/dev/usb/lp1",
    "/dev/usb/lp2",
    "/dev/usb/lp3",
    "/dev/usb/lp4",
  ];

  for (const device of devices) {
    if (fs.existsSync(device)) {
      return device;
    }
  }

  return null;
}

const printerConfig = {
  usbDevice: process.env.USB_DEVICE_PATH || detectUsbPrinter(),
  tcpHost: process.env.PRINTER_IP || "192.168.1.100",
  tcpPort: Number(process.env.PRINTER_PORT) || 9100,
  connectionType: process.env.CONNECTION_TYPE || "auto",
  name: "EPSON TM-T82II",
  model: "TM-T82II",
  paperWidth: 80,
};

/**
 * Helper: Check if USB device is available
 */
function checkUSBDevice() {
  try {
    const stat = fs.statSync(printerConfig.usbDevice);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Helper: Check if TCP printer is reachable
 */
function checkTCPPrinter() {
  return new Promise((resolve) => {
    const socket = net.createConnection(
      {
        host: printerConfig.tcpHost,
        port: printerConfig.tcpPort,
        timeout: 2000,
      },
      () => {
        socket.destroy();
        resolve(true);
      },
    );

    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
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
    try {
      fs.writeFileSync(printerConfig.usbDevice, data);
      log(`✓ Data written to ${printerConfig.usbDevice}`);
      resolve({ method: "usb", device: printerConfig.usbDevice });
    } catch (error) {
      if (error.code === "EACCES") {
        // Try with sudo
        log(
          "USB write failed (permission denied), attempting with sudo...",
          true,
        );
        try {
          const tempFile = `/tmp/receipt_${Date.now()}.bin`;
          fs.writeFileSync(tempFile, data);
          execSync(
            `sudo tee ${printerConfig.usbDevice} < ${tempFile} > /dev/null`,
            {
              stdio: "pipe",
            },
          );
          fs.unlinkSync(tempFile);
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
 * Print via TCP/IP
 */
function printTCP(data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      {
        host: printerConfig.tcpHost,
        port: printerConfig.tcpPort,
        timeout: 5000,
      },
      () => {
        socket.write(data);
        socket.on("finish", () => {
          log(
            `✓ Data sent to ${printerConfig.tcpHost}:${printerConfig.tcpPort}`,
          );
          resolve({
            method: "tcp",
            host: printerConfig.tcpHost,
            port: printerConfig.tcpPort,
          });
        });
        socket.end();
      },
    );

    socket.on("error", (error) => {
      reject(new Error(`TCP connection failed: ${error.message}`));
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(
        new Error(
          `TCP connection timeout (${printerConfig.tcpHost}:${printerConfig.tcpPort})`,
        ),
      );
    });
  });
}

/**
 * Print with auto-detection
 */
async function printAuto(data) {
  const usbAvailable = checkUSBDevice();
  const tcpAvailable = await checkTCPPrinter();

  log(`Auto-detection: USB=${usbAvailable}, TCP=${tcpAvailable}`, true);

  if (tcpAvailable) {
    log("Using TCP/IP connection...", true);
    return await printTCP(data);
  } else if (usbAvailable) {
    log("Using USB connection...", true);
    return await printUSB(data);
  } else {
    throw new Error("No printer available (USB or TCP)");
  }
}

/**
 * Determine connection method
 */
async function determineConnection(method = null) {
  const mode = method || printerConfig.connectionType;

  switch (mode) {
    case "usb":
      if (!checkUSBDevice()) {
        throw new Error(`USB device not found at ${printerConfig.usbDevice}`);
      }
      return "usb";

    case "tcp":
      if (!(await checkTCPPrinter())) {
        throw new Error(
          `TCP printer not reachable at ${printerConfig.tcpHost}:${printerConfig.tcpPort}`,
        );
      }
      return "tcp";

    case "auto":
    default:
      return null; // Auto-detect
  }
}

/**
 * GET /health - Health check
 */
app.get("/health", async (req, res) => {
  try {
    const usbAvailable = checkUSBDevice();
    const tcpAvailable = await checkTCPPrinter();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      printer: {
        name: printerConfig.name,
        model: printerConfig.model,
        detected: usbAvailable || tcpAvailable,
        connections: {
          usb: {
            available: usbAvailable,
            device: printerConfig.usbDevice,
          },
          tcp: {
            available: tcpAvailable,
            host: printerConfig.tcpHost,
            port: printerConfig.tcpPort,
          },
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
app.get("/printers", async (req, res) => {
  try {
    const usbAvailable = checkUSBDevice();
    const tcpAvailable = await checkTCPPrinter();

    res.json({
      available: usbAvailable || tcpAvailable,
      printer: printerConfig.name,
      connections: {
        usb: usbAvailable
          ? `${printerConfig.usbDevice} (available)`
          : `${printerConfig.usbDevice} (not found)`,
        tcp: tcpAvailable
          ? `${printerConfig.tcpHost}:${printerConfig.tcpPort} (available)`
          : `${printerConfig.tcpHost}:${printerConfig.tcpPort} (unreachable)`,
      },
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
    const { usbDevice, tcpHost, tcpPort, connectionType } = req.body;

    if (usbDevice) printerConfig.usbDevice = usbDevice;
    if (tcpHost) printerConfig.tcpHost = tcpHost;
    if (tcpPort) printerConfig.tcpPort = tcpPort;
    if (connectionType) printerConfig.connectionType = connectionType;

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
      hint: "Look for vendor ID 04b8 (Epson). Product IDs: 0202 (TM-T82), 0e11 (TM-T82II), etc.",
      usbDeviceFiles: {
        typical: ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/lp0", "/dev/lp1"],
        current: printerConfig.usbDevice,
        exists: checkUSBDevice(),
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
      connectionType,
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
    let result;
    const connection = await determineConnection(connectionType);

    if (connection === "usb") {
      result = await printUSB(receiptData);
    } else if (connection === "tcp") {
      result = await printTCP(receiptData);
    } else {
      result = await printAuto(receiptData);
    }

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
        "Verify USB cable is connected or network is reachable",
        "Run: npm run detect (to see available printers)",
        "Check permissions: ls -la /dev/usb/lp*",
        "For USB: may need to run with sudo or add user to lpadmin group",
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

    let result;
    const connection = await determineConnection();

    if (connection === "usb") {
      result = await printUSB(receiptData);
    } else if (connection === "tcp") {
      result = await printTCP(receiptData);
    } else {
      result = await printAuto(receiptData);
    }

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
║    EPSON TM-T82II Print Server - Ubuntu Linux                ║
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
  GET  /debug/devices       - List USB devices (lsusb)
  GET  /debug/cups          - List CUPS printers

Configuration:
  Port: ${PORT}
  USB Device: ${printerConfig.usbDevice}
  TCP Address: ${printerConfig.tcpHost}:${printerConfig.tcpPort}
  Connection: ${printerConfig.connectionType}
  Debug: ${DEBUG}

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
  USB_DEVICE_PATH   - USB device path (default: /dev/usb/lp0)
  PRINTER_IP        - Printer IP for TCP (default: 192.168.1.100)
  PRINTER_PORT      - Printer port for TCP (default: 9100)
  CONNECTION_TYPE   - 'auto', 'usb', or 'tcp' (default: auto)
  DEBUG             - Enable debug logging (default: false)

For troubleshooting, run:
  npm run detect    - Detect connected printers
  npm run server:dev - Start with debug output
  `);

  // Auto-detect printer
  (async () => {
    try {
      const usbAvailable = checkUSBDevice();
      const tcpAvailable = await checkTCPPrinter();

      if (usbAvailable) {
        log(`✓ USB printer detected at ${printerConfig.usbDevice}`, false);
      } else {
        log(`✗ USB printer not found at ${printerConfig.usbDevice}`, false);
      }

      if (tcpAvailable) {
        log(
          `✓ TCP printer detected at ${printerConfig.tcpHost}:${printerConfig.tcpPort}`,
          false,
        );
      } else {
        log(
          `✗ TCP printer not found at ${printerConfig.tcpHost}:${printerConfig.tcpPort}`,
          false,
        );
      }
    } catch (e) {
      log(`Error during printer detection: ${e.message}`, true);
    }
  })();
});
