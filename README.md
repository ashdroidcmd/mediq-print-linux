# 🖨️ EPSON TM-T82II Ubuntu Linux Print Server

Thermal printer test for EPSON TM-T82II on Ubuntu Linux.

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies

```bash
sudo apt update

sudo apt install -y \
  cups \
  usbutils \
  libudev-dev \
  build-essential
```

### Step 2: Detect Printer

Plug in the printer, then run:

```bash
lsusb
```

Look for: **Seiko Epson Corp.**

Check device node:

```bash
ls /dev/usb/lp0
```

### Step 3: Test Direct Print

```bash
echo "HELLO EPSON TM-T82II TEST" | sudo tee /dev/usb/lp0
```

If it works, skip to Step 5. If permission denied, do Step 4.

### Step 4: Fix Permissions

```bash
sudo usermod -aG lp $USER
sudo usermod -aG dialout $USER
sudo reboot
```

### Step 5: Install Node.js

```bash
# Install Node.js (if not already installed)
sudo apt install -y nodejs npm

# Verify
node --version
npm --version
```

### Step 6: Install & Run Print Server

```bash
# Clone this repo or navigate to it
cd test-print-linux

# Install npm dependencies
npm install

# Start the print server
npm run server
```

Server runs on: `http://localhost:3002`

## 🧪 Test It

### Option 1: CLI Test

```bash
# In another terminal
npm test               # Auto-detect
npm run test:usb      # USB only
npm run test:tcp 192.168.1.100  # TCP/IP
```

### Option 2: HTTP API

```bash
# Check printer status
curl http://localhost:3002/health

# Print a ticket
curl -X POST http://localhost:3002/print \
  -H "Content-Type: application/json" \
  -d '{
    "queueNumber": "A01",
    "departmentName": "Registration",
    "serviceName": "Checkup"
  }'
```

## 📋 What This Does

✅ Prints hardcoded test receipt  
✅ Supports USB and TCP/IP connections  
✅ Auto-detects printer  
✅ Provides REST API for printing  
✅ Works with React frontend

## 🔍 Detect Printers

```bash
npm run detect
```

Shows:

- USB devices
- USB permissions
- Network printers (if CUPS installed)

## 📚 Documentation

- [Print Server API](./PRINT_SERVER_README.md) - HTTP endpoints reference
- [Frontend Integration](./FRONTEND_INTEGRATION.md) - React integration guide
- [Full Setup Guide](./UBUNTU_SETUP.md) - Detailed instructions
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues & fixes
- [Quick Reference](./QUICK_REFERENCE.md) - Command cheat sheet

## 🚀 Quick Commands

```bash
npm run server              # Start HTTP server
npm run server:dev         # Start with debug logging
npm test                   # Test print (auto-detect)
npm run test:usb          # Test USB print
npm run test:tcp [IP]     # Test TCP print
npm run detect            # Find connected printers
npm run help              # Show usage examples
```

## ⚠️ Common Issues

### "Permission denied" on /dev/usb/lp0

```bash
sudo usermod -aG lp $USER
sudo usermod -aG dialout $USER
reboot
```

### "No printer found"

```bash
# Check if plugged in
lsusb | grep Epson

# Check device exists
ls -la /dev/usb/lp* /dev/lp*

# Try TCP/IP instead
npm run test:tcp 192.168.1.100
```

### "Port 3002 already in use"

```bash
# Use different port
PORT=3003 npm run server

# Or kill existing process
killall node
```

## 🔗 Integration

Integrate with React frontend - see [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)

```typescript
import { printService } from "@/services/printService";

await printService.printTicket({
  queueNumber: "A01",
  departmentName: "Registration",
  serviceName: "Checkup",
});
```

## 📞 Support

Run verification script:

```bash
./verify.sh
```

Shows:

- System requirements ✓
- Files present ✓
- Dependencies installed ✓
- Printer detected ✓
- Port available ✓
- Server can start ✓

## 🎯 Next Steps

1. **USB Only**: Plug printer, run `npm test:usb`
2. **Network**: Configure IP, run `npm run test:tcp [IP]`
3. **HTTP Server**: Run `npm run server`, then use API
4. **Frontend**: See [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)
5. **Docker**: Build and deploy container

---

**Built for MediQ HIS on Ubuntu Linux** 🖨️✨
