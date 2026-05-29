# 🖨️ EPSON TM-T82II Ubuntu Linux Thermal Printer Test

**Minimal test application to verify EPSON TM-T82II printing works on Ubuntu Linux**

> ⚠️ **Test Only** — This is for printer verification only. No queue logic, APIs, or integrations yet.
>
> ✨ **Zero External Dependencies** — Uses only Node.js built-in modules

---

## ⚡ 2-Minute Quick Start (Zero Dependencies!)

```bash
# 1. Detect your printer
npm run detect

# 2. Print test receipt
npm test
# or specific:
npm run test:tcp 192.168.1.100  # Network printer
npm run test:usb                 # USB printer
```

Expected output: **Test receipt prints from thermal printer** ✓

---

## 📋 What This Does

This minimal Node.js application:

✅ **Prints a hardcoded test receipt** with:

- Department name
- Queue number
- Date/Time
- Patient info
- Printer status info

✅ **Supports two connection types:**

- **Network (TCP/IP)** — Port 9100 (Recommended)
- **USB** — /dev/usb/lp0

✅ **Auto-detects printer**:

- Tries network first
- Falls back to USB
- Shows clear error messages

✅ **Beginner-friendly**:

- Colored console output
- Clear diagnostic steps
- Troubleshooting guide included

---

## 📦 What's Included

```
test-print-linux/
├── package.json              # Node.js dependencies
├── test-print.js             # Main test script
├── detect-printer.js         # Printer detection utility
├── README.md                 # This file
├── UBUNTU_SETUP.md           # Complete setup guide
└── TROUBLESHOOTING.md        # Detailed troubleshooting
```

---

## 🚀 Installation

### Prerequisites

- **Ubuntu 20.04+ LTS** (or similar Debian-based)
- **Node.js 14+**
- **EPSON TM-T82II printer** (USB or Network)

### System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
sudo apt install -y nodejs npm

# Install printer support
sudo apt install -y libusb-1.0-0 libusb-1.0-0-dev cups cups-client

# For USB printer: Add yourself to printer group
sudo usermod -a -G lpadmin $USER
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect
```

### Project Setup

```bash
# Navigate to test-print-linux
cd test-print-linux

# Install Node dependencies
npm install
# Installs: node-thermal-printer, chalk

# Verify installation
npm ls
```

---

## 🎯 Quick Start Commands

### Detect Printer

```bash
npm run detect
```

Shows:

- USB printers connected
- Network printers available
- User permissions
- Scanning common network IPs

### Print Test Receipt

```bash
# Auto-detect (recommended)
npm test
node test-print.js

# Network printer (TCP/IP)
npm run test:tcp 192.168.1.100
node test-print.js --tcp 192.168.1.100

# USB printer
npm run test:usb
node test-print.js --usb

# Help
npm run help
node test-print.js --help
```

---

## 🔧 Connection Setup

### Network Printer (TCP/IP)

**Best for**: Multi-user setups, easier to debug

1. **Find printer IP:**

   ```bash
   npm run detect  # Shows available network printers
   ```

2. **Test connectivity:**

   ```bash
   ping 192.168.1.100
   nc -zv 192.168.1.100 9100  # Should say "succeeded"
   ```

3. **Print test:**
   ```bash
   npm run test:tcp 192.168.1.100
   ```

### USB Printer

**Best for**: Single-user setups, direct connection

1. **Check permissions:**

   ```bash
   groups
   # Should show: lpadmin, dialout

   # If not, add permissions:
   sudo usermod -a -G lpadmin $USER
   sudo usermod -a -G dialout $USER
   # Log out and log back in
   ```

2. **Verify USB device:**

   ```bash
   npm run detect  # Shows USB printers
   # Should show: /dev/usb/lp0 or similar
   ```

3. **Print test:**
   ```bash
   npm run test:usb
   ```

---

## 📖 Detailed Guides

For complete setup and troubleshooting, see:

- **[UBUNTU_SETUP.md](UBUNTU_SETUP.md)** — Complete installation and configuration
  - System dependency installation
  - Detailed connection setup (TCP/IP and USB)
  - Permissions configuration
  - Sample configurations
  - Verification checklist

- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — Comprehensive troubleshooting
  - Common issues and solutions
  - Diagnostic commands
  - Error reference table
  - USB/Network troubleshooting
  - Debugging steps

---

## 🛠️ Useful Commands

```bash
# Printer detection
npm run detect              # Detect all printers
lsusb                      # List USB devices
lpstat -p -d               # CUPS printers

# USB troubleshooting
ls -la /dev/usb/lp*        # USB device files
groups $USER               # Check permissions
dmesg | tail -20           # Kernel logs for USB

# Network troubleshooting
ping 192.168.1.100         # Ping printer
nc -zv 192.168.1.100 9100  # Check port
telnet 192.168.1.100 9100  # Connect (Ctrl+C to exit)

# CUPS management
sudo systemctl status cups # CUPS daemon status
sudo systemctl start cups  # Start CUPS
sudo systemctl restart cups # Restart CUPS
lpq                        # Print queue
cancel -a                  # Cancel all jobs
```

---

## ✅ Success Checklist

- [ ] Node.js installed (v14+)
- [ ] npm dependencies installed (`npm install`)
- [ ] Printer detected (`npm run detect`)
- [ ] Printer permissions correct (USB) or network connectivity verified (TCP/IP)
- [ ] Test print works (`npm test`)
- [ ] Receipt prints from thermal printer

---

## ❓ Common Issues

| Issue                      | Solution                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| `Permission denied` (USB)  | Run: `sudo usermod -a -G lpadmin $USER` then logout/login             |
| `No device found` (USB)    | Run: `lsusb` to verify printer, check /dev/usb/lp\*                   |
| `Connection refused` (TCP) | Verify IP: `ping 192.168.1.100` and port: `nc -zv 192.168.1.100 9100` |
| `Cannot find module`       | Run: `npm install` in test-print-linux directory                      |
| `Cannot find printer`      | Run: `npm run detect` to find all printers                            |

See **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for detailed troubleshooting.

---

## 📝 Script Details

### test-print.js

Prints hardcoded receipt with:

- Bold title and centered text
- Patient information
- Queue number
- Timestamp
- Printer connection info
- Auto paper cut

### detect-printer.js

Detects:

- USB printers via `lsusb`
- CUPS printers via `lpstat`
- User permissions
- Common network IPs on local subnet

---

## 🎓 What You'll Learn

After running this test:

✅ Your Ubuntu can communicate with the printer
✅ Correct connection type for your setup
✅ Printer IP address (if network) or USB device path
✅ Required permissions and configurations
✅ How to diagnose printer issues
✅ Basic thermal printer ESC/POS commands

---

## 🚫 What This Is NOT

This test application does **NOT**:

- ❌ Create queue numbers (for hospital workflows)
- ❌ Provide REST APIs (use for microservices)
- ❌ Integrate with databases
- ❌ Create web interfaces
- ❌ Manage multiple printers
- ❌ Queue print jobs
- ❌ Implement hospital workflows

**This is ONLY for verifying the printer works on Ubuntu Linux.**

For production use, you'll need a separate print server (Express.js backend) and frontend integration.

---

## 🔄 Next Steps

Once testing works:

1. ✅ Document your printer setup:

   ```bash
   # Save this info
   echo "Printer IP: 192.168.1.100" > printer-config.txt
   echo "Connection: TCP/IP" >> printer-config.txt
   npm run detect >> printer-config.txt
   ```

2. ✅ Create production Express.js server:

   ```bash
   # Will handle real queue numbers, multiple printers, etc.
   npm install express body-parser node-thermal-printer
   # Create print server...
   ```

3. ✅ Integrate with frontend application

4. ✅ Add hospital workflow logic

---

## 📞 Debugging

If test fails:

```bash
# 1. Comprehensive detection
npm run detect

# 2. Check system
node --version
npm --version
uname -a

# 3. Verbose output
DEBUG=* npm test

# 4. Check logs
dmesg | tail -20
journalctl -u cups -f
```

See **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for detailed debugging steps.

---

## 📚 Resources

- [EPSON TM-T82II Manual](https://www.epson.com/cgi-bin/Store/support/downloads/)
- [ESC/POS Command Reference](https://www.epson.com/cgi-bin/Store/support/downloads/)
- [node-thermal-printer Docs](https://github.com/Klemen1337/node-thermal-printer)
- [Ubuntu CUPS Documentation](https://wiki.ubuntu.com/CUPS)

---

## 📄 License

MIT

---

## ✨ Summary

This minimal test application confirms:

✓ **Printer is detected** on Ubuntu
✓ **Connection type works** (TCP/IP or USB)
✓ **Permissions are correct**
✓ **Test receipt prints successfully**

Once confirmed, you can proceed with production server setup and integration!

🖨️ **Ready to print!**
