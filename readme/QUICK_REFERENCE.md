# 🖨️ EPSON TM-T82II Ubuntu Linux Quick Reference

## Installation (One-Time)

```bash
# System packages
sudo apt update
sudo apt install -y nodejs npm libusb-1.0-0 libusb-1.0-0-dev cups

# Project setup
cd test-print-linux
npm install

# Grant permissions (USB only)
sudo usermod -a -G lpadmin $USER
sudo usermod -a -G dialout $USER
# Then log out and back in
```

---

## Running Tests

### Auto-Detect (Recommended)

```bash
npm test
node test-print.js
```

### Network Printer (TCP/IP)

```bash
npm run test:tcp 192.168.1.100
node test-print.js --tcp 192.168.1.100

# Find your printer IP
npm run detect
```

### USB Printer

```bash
npm run test:usb
node test-print.js --usb
```

### Help

```bash
npm run help
node test-print.js --help
```

---

## Printer Detection

```bash
npm run detect          # Full detection
lsusb                  # USB devices
lsusb | grep -i epson  # EPSON devices
lpstat -p -d           # CUPS printers
ls -la /dev/usb/lp*    # USB device files
```

---

## Network Printer Troubleshooting

```bash
# Find printer IP
npm run detect

# Test ping
ping 192.168.1.100

# Test port 9100
nc -zv 192.168.1.100 9100      # Should: succeeded
bash -c 'echo > /dev/tcp/192.168.1.100/9100'  # No error = open

# Connect for debugging
telnet 192.168.1.100 9100  # Ctrl+C to exit
```

---

## USB Printer Troubleshooting

```bash
# Check device exists
ls -la /dev/usb/lp*
lsusb | grep -i epson

# Check permissions
groups
id

# Add permissions
sudo usermod -a -G lpadmin $USER
sudo usermod -a -G dialout $USER
# Log out and log back in

# Check USB events
dmesg | tail -20 | grep -i usb
dmesg | tail -20 | grep -i epson

# Monitor live
dmesg -w  # Ctrl+C to stop
```

---

## CUPS Management

```bash
# Status
sudo systemctl status cups

# Start/Stop
sudo systemctl start cups
sudo systemctl stop cups
sudo systemctl restart cups

# Logs
sudo tail -f /var/log/cups/error_log
journalctl -u cups -f

# Print queue
lpq
lpstat -o  # Show jobs

# Cancel jobs
cancel -a  # Cancel all
lpstat -p -l
```

---

## System Info

```bash
# Check Node.js
node --version    # Should be v14+
npm --version

# Check OS
uname -a
lsb_release -a

# Check installed packages
npm ls

# Network info
ifconfig
ip addr
```

---

## Common Errors & Quick Fixes

| Error                    | Fix                                         |
| ------------------------ | ------------------------------------------- |
| Permission denied (USB)  | `sudo usermod -a -G lpadmin $USER` + logout |
| No device /dev/usb/lp0   | `lsusb` verify printer, check USB cable     |
| Connection refused (TCP) | `ping 192.168.1.100` verify IP              |
| Cannot find module       | `npm install` in test-print-linux directory |
| Port already in use      | Kill: `pkill -f "node"`                     |

---

## One-Liner Commands

```bash
# Detect and test in one command
npm run detect && echo "---" && npm test

# List all EPSON devices
lsusb | grep -i epson && echo "USB found" || echo "USB not found"

# Check if port 9100 is open
bash -c 'echo > /dev/tcp/192.168.1.100/9100' && echo "✓ Port open" || echo "❌ Port closed"

# Show all /dev files for printers
ls -la /dev/*lp* 2>/dev/null

# Check user is in printer groups
id | grep -E "lp|lpadmin|dialout" && echo "✓ Permissions OK" || echo "❌ Need permissions"

# Current printer setup
lpstat -p -d && echo "Found" || echo "No CUPS printers"
```

---

## Configuration

### Environment Variables (.env)

```bash
# TCP/IP printer
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
CONNECTION_TYPE=tcp

# USB printer
USB_DEVICE_PATH=/dev/usb/lp0
CONNECTION_TYPE=usb
```

See `.env.example` for full options.

---

## Useful Files

- `test-print.js` — Main test script
- `detect-printer.js` — Printer detection
- `package.json` — Dependencies
- `README.md` — Overview
- `UBUNTU_SETUP.md` — Complete setup guide
- `TROUBLESHOOTING.md` — Detailed troubleshooting
- `.env.example` — Configuration template

---

## Quick Test Workflow

```bash
# 1. Check printer is connected
lsusb | grep -i epson
# OR
ping 192.168.1.100

# 2. Install dependencies
npm install

# 3. Detect printer
npm run detect

# 4. Run appropriate test
npm test              # Auto-detect
npm run test:tcp 192.168.1.100  # Network
npm run test:usb      # USB

# 5. Check printer output
# Receipt should print ✓
```

---

## More Info

- **Setup**: See `UBUNTU_SETUP.md`
- **Troubleshooting**: See `TROUBLESHOOTING.md`
- **Detailed Guide**: See `README.md`

---

**Print successful?** ✓
Then you're ready for production server setup!
