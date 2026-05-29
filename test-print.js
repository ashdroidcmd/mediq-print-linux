#!/usr/bin/env node

/**
 * Minimal Ubuntu Linux Thermal Printer Test
 *
 * EPSON TM-T82II - Hardcoded Receipt Test
 *
 * Usage:
 *   node test-print.js              # Auto-detect printer
 *   node test-print.js --tcp 192.168.1.100   # TCP/IP printer
 *   node test-print.js --usb        # USB printer
 *   node test-print.js --help       # Show help
 */

const fs = require("fs");
const net = require("net");
const { execSync } = require("child_process");

// Color output for console
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log("", "cyan");
  log("═".repeat(50), "cyan");
  log(`  ${title}`, "bright");
  log("═".repeat(50), "cyan");
  log("", "cyan");
}

function showHelp() {
  log("EPSON TM-T82II Ubuntu Linux Test Print", "bright");
  log("");
  log("Usage:");
  log(
    "  node test-print.js                      # Auto-detect printer",
    "cyan",
  );
  log(
    "  node test-print.js --tcp 192.168.1.100  # TCP/IP network printer",
    "cyan",
  );
  log("  node test-print.js --usb                # USB printer", "cyan");
  log("  node test-print.js --help               # This help message", "cyan");
  log("");
  log("Examples:");
  log("  npm test                                # Run default test", "yellow");
  log(
    "  npm run test:tcp 192.168.1.100          # Test network printer",
    "yellow",
  );
  log("  npm run test:usb                        # Test USB printer", "yellow");
  log("  npm run detect                          # Detect printer", "yellow");
  log("");
}

function getPrinterConfig() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  // TCP/IP printer
  if (args.includes("--tcp")) {
    const ipIndex = args.indexOf("--tcp");
    const ip = args[ipIndex + 1] || "192.168.1.100";
    log(`📡 Using TCP/IP printer at ${ip}:9100`, "yellow");
    return {
      type: "tcp",
      ip: ip,
      port: 9100,
    };
  }

  // USB printer
  if (args.includes("--usb")) {
    log(`🔌 Using USB printer`, "yellow");
    return {
      type: "usb",
      interface: "/dev/usb/lp0",
    };
  }

  // Auto-detect (try TCP first, fallback to USB)
  log(`🔍 Auto-detecting printer...`, "yellow");
  return {
    type: "auto",
  };
}

// ESC/POS Commands
const ESC = "\x1B";
const GS = "\x1D";

function generateReceipt() {
  let receipt = "";

  // Initialize printer
  receipt += ESC + "@"; // Reset printer

  // Title - Double height, bold, centered
  receipt += ESC + "E" + "\x01"; // Bold on
  receipt += ESC + "i\x00\x01"; // Select double-height
  receipt += ESC + "a" + "\x01"; // Center align
  receipt += "MEDIQUE HIS\n";

  // Return to normal
  receipt += ESC + "E" + "\x00"; // Bold off
  receipt += ESC + "i\x00\x00"; // Normal height
  receipt += "\n";

  // Subtitle
  receipt += ESC + "a" + "\x01"; // Center align
  receipt += "Ubuntu Linux Test Print\n";
  receipt += "═".repeat(42) + "\n";

  // Body - Left align
  receipt += ESC + "a" + "\x00"; // Left align
  receipt += "\n";

  // Patient info
  receipt += "Patient: JUAN DELA CRUZ\n";
  receipt += "Queue No: TEST-001\n";
  receipt += "Date: " + new Date().toLocaleString() + "\n";
  receipt += "\n";

  // Test section - Center
  receipt += ESC + "a" + "\x01"; // Center align
  receipt += ESC + "E" + "\x01"; // Bold on
  receipt += "EPSON TM-T82II TEST\n";
  receipt += ESC + "E" + "\x00"; // Bold off
  receipt += "═".repeat(42) + "\n";

  // Details - Left align
  receipt += ESC + "a" + "\x00"; // Left align
  receipt += "\n";
  receipt += "Status: ✓ Printer Connected\n";
  receipt += "Model: EPSON TM-T82II\n";
  receipt += "Connection: Ubuntu Linux\n";
  receipt += "Port: Device or TCP/IP\n";
  receipt += "\n";

  // Footer - Center
  receipt += ESC + "a" + "\x01"; // Center align
  receipt += "═".repeat(42) + "\n";
  receipt += "TEST RECEIPT COMPLETE\n";
  receipt += "Time: " + new Date().toLocaleTimeString() + "\n";
  receipt += "\n";

  // Auto cut
  receipt += GS + "V" + "\x42" + "\x00"; // Cut paper

  return Buffer.from(receipt, "latin1");
}

function printViaUSB(devicePath, data) {
  return new Promise((resolve, reject) => {
    log("Writing to USB device...", "cyan");

    try {
      // Try to write directly to device
      fs.writeFileSync(devicePath, data);
      log("✓ Data written successfully", "green");
      resolve();
    } catch (error) {
      // If direct write fails, try with sudo
      try {
        const dataHex = data.toString("hex");
        execSync(
          `echo "${dataHex}" | xxd -r -p | sudo tee ${devicePath} > /dev/null 2>&1`,
        );
        log("✓ Data written with sudo", "green");
        resolve();
      } catch (sudoError) {
        reject(
          new Error(
            `Failed to write to USB device at ${devicePath}:\n  Error: ${error.message}`,
          ),
        );
      }
    }
  });
}

function printViaTCP(ip, port, data) {
  return new Promise((resolve, reject) => {
    log(`Connecting to ${ip}:${port}...`, "cyan");

    const socket = net.createConnection(port, ip);

    socket.setTimeout(5000);

    socket.on("connect", () => {
      log("✓ Connected, sending data...", "green");
      socket.write(data);
      socket.end();
    });

    socket.on("end", () => {
      log("✓ Data sent successfully", "green");
      resolve();
    });

    socket.on("error", (error) => {
      reject(error);
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timeout"));
    });
  });
}

async function testPrinter() {
  logSection("EPSON TM-T82II Ubuntu Linux Test Print");

  const config = getPrinterConfig();

  try {
    const receiptData = generateReceipt();
    log(`Receipt data generated (${receiptData.length} bytes)`, "cyan");
    log("");

    // Try connection based on config
    if (config.type === "tcp" || config.type === "auto") {
      try {
        log(`Attempting TCP/IP connection...`, "cyan");
        await printViaTCP(
          config.ip || "192.168.1.100",
          config.port || 9100,
          receiptData,
        );
        log(
          `✓ Connected to TCP printer at ${config.ip}:${config.port}`,
          "green",
        );
      } catch (tcpError) {
        if (config.type === "auto") {
          log(`⚠️  TCP connection failed, trying USB...`, "yellow");
          try {
            await printViaUSB("/dev/usb/lp0", receiptData);
            log(`✓ Connected to USB printer at /dev/usb/lp0`, "green");
          } catch (usbError) {
            throw new Error(
              `Failed to connect to both TCP and USB printers:\n  TCP: ${tcpError.message}\n  USB: ${usbError.message}`,
            );
          }
        } else {
          throw tcpError;
        }
      }
    } else if (config.type === "usb") {
      await printViaUSB(config.interface, receiptData);
      log(`✓ Connected to USB printer at ${config.interface}`, "green");
    }

    log("", "cyan");
    log("✓ Print job sent successfully!", "green");
    log("", "cyan");
    log("Printer should now print a test receipt.", "green");
    log("Check printer output and paper tray.", "green");
    log("", "cyan");

    logSection("Test Complete");
  } catch (error) {
    log("", "cyan");
    log(`❌ Error: ${error.message}`, "red");
    log("", "cyan");

    log("Troubleshooting Tips:", "yellow");
    log("1. Check printer connection:", "cyan");
    log("   lpstat -p -d          # Check installed printers", "yellow");
    log("   lsusb                 # Check USB devices", "yellow");
    log("");
    log("2. Test TCP/IP printer:", "cyan");
    log("   ping 192.168.1.100    # Check network connectivity", "yellow");
    log("");
    log("3. Check USB permissions:", "cyan");
    log("   ls -la /dev/usb/lp*   # Check USB permissions", "yellow");
    log(
      "   sudo usermod -a -G lpadmin $USER  # Add to printer group",
      "yellow",
    );
    log("");
    log("4. Run detection script:", "cyan");
    log("   npm run detect        # Detect connected printers", "yellow");
    log("");

    process.exit(1);
  }
}

// Run test
testPrinter().catch((error) => {
  log(`Fatal error: ${error.message}`, "red");
  process.exit(1);
});
