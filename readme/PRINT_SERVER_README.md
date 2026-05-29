# 🖨️ EPSON TM-T82II Print Server for Ubuntu Linux

Express.js-based HTTP API for thermal printer queue management. Works natively on Ubuntu Linux using built-in device files (no external USB library).

## 🚀 Quick Start

```bash
# Start the print server
npm run server

# Or with debug logging
npm run server:dev
```

Server runs on `http://localhost:3002`

## 📡 API Endpoints

### Health & Status

```bash
# Check printer status
curl http://localhost:3002/health

# List available printers
curl http://localhost:3002/printers

# View current configuration
curl http://localhost:3002/config
```

### Print Operations

```bash
# Print a queue ticket
curl -X POST http://localhost:3002/print \
  -H "Content-Type: application/json" \
  -d '{
    "queueNumber": "A01",
    "departmentName": "Registration",
    "serviceName": "General Checkup",
    "priorityName": "Normal",
    "timestamp": "2026-05-29 14:30:00"
  }'

# Test print
curl -X POST http://localhost:3002/test-print
```

### Debug Endpoints

```bash
# List USB devices (with vendor/product IDs)
curl http://localhost:3002/debug/devices

# List CUPS printers
curl http://localhost:3002/debug/cups

# Update printer configuration
curl -X POST http://localhost:3002/config \
  -H "Content-Type: application/json" \
  -d '{
    "usbDevice": "/dev/usb/lp0",
    "tcpHost": "192.168.1.100",
    "tcpPort": 9100,
    "connectionType": "auto"
  }'
```

## 🔌 Connection Methods

### USB (Direct Device File)

- **Device Path**: `/dev/usb/lp0` (may also be `/dev/lp0`, `/dev/usb/lp1`, etc.)
- **Default**: Enabled if device exists
- **Permissions**: May require `sudo` or add user to `lpadmin` group

### TCP/IP (Network)

- **Default Address**: `192.168.1.100:9100`
- **Port**: 9100 (standard for EPSON thermal)
- **Connection Type**: Ethernet cable to printer or network configuration

### Auto-Detection

- **Default Mode**: Tries TCP/IP first, falls back to USB
- **Set with**: `CONNECTION_TYPE=auto` environment variable

## ⚙️ Configuration

### Environment Variables

```bash
# Server port
PORT=3002

# USB device path
USB_DEVICE_PATH=/dev/usb/lp0

# TCP printer IP
PRINTER_IP=192.168.1.100

# TCP printer port
PRINTER_PORT=9100

# Connection type: 'auto', 'usb', or 'tcp'
CONNECTION_TYPE=auto

# Enable debug logging
DEBUG=true
```

### Runtime Configuration

Update printer settings via API:

```bash
curl -X POST http://localhost:3002/config \
  -H "Content-Type: application/json" \
  -d '{
    "tcpHost": "192.168.1.50",
    "connectionType": "tcp"
  }'
```

## 🧪 Testing

### 1. Detect Connected Printers

```bash
npm run detect
```

### 2. Check Server Health

```bash
curl http://localhost:3002/health | jq
```

Sample response:

```json
{
  "status": "ok",
  "timestamp": "2026-05-29T09:01:51.123Z",
  "printer": {
    "name": "EPSON TM-T82II",
    "model": "TM-T82II",
    "detected": true,
    "connections": {
      "usb": {
        "available": true,
        "device": "/dev/usb/lp0"
      },
      "tcp": {
        "available": false,
        "host": "192.168.1.100",
        "port": 9100
      }
    }
  }
}
```

### 3. Send Test Print

```bash
curl -X POST http://localhost:3002/test-print
```

Response:

```json
{
  "success": true,
  "message": "Test print successful",
  "method": "usb",
  "bytes": 443,
  "timestamp": "2026-05-29T09:01:51.123Z"
}
```

## 🐛 Troubleshooting

### USB Device Not Found

```bash
# List USB devices
lsusb

# Check device files
ls -la /dev/usb/lp* /dev/lp*

# Check permissions
ls -la /dev/usb/lp0
```

If you see permission denied:

```bash
# Add user to lpadmin group
sudo usermod -a -G lpadmin $USER

# Then log out and log back in

# Or use sudo for server
sudo npm run server
```

### TCP Printer Not Reachable

```bash
# Check network connectivity
ping 192.168.1.100

# Check port is open
nc -zv 192.168.1.100 9100

# Or scan for printers
nmap -p 9100 192.168.1.0/24
```

### CUPS Printer Issues

If printer is managed by CUPS, you may need to use the CUPS queue name instead:

```bash
# List CUPS printers
curl http://localhost:3002/debug/cups

# Or use command line
lpstat -p -d
```

## 📦 Dependencies

- **express**: HTTP server framework
- **cors**: Cross-origin resource sharing
- **body-parser**: JSON/form request parsing
- **Built-in modules**: fs, net, child_process (no external USB library)

## ✨ Key Features

✅ **Zero External USB Dependency** — Uses native Linux device files  
✅ **Auto-Detection** — Tries TCP first, falls back to USB  
✅ **Sudo Fallback** — Automatically escalates USB permissions when needed  
✅ **REST API** — Standard HTTP endpoints with JSON payloads  
✅ **Debug Endpoints** — Troubleshooting tools built-in  
✅ **Runtime Configuration** — Update settings without restart  
✅ **ESC/POS Native** — Direct thermal printer commands

## 🔌 Printer Connection Diagram

```
Ubuntu Linux Server
    ├─ HTTP (localhost:3002)
    │   └─ Client application
    ├─ /dev/usb/lp0 (USB)
    │   └─ EPSON TM-T82II [USB Cable]
    └─ 192.168.1.100:9100 (TCP)
        └─ EPSON TM-T82II [Ethernet Cable]
```

## 📝 Example: Print Queue Integration

```javascript
// Node.js client example
const printTicket = async (queue) => {
  const response = await fetch("http://localhost:3002/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      queueNumber: queue.number,
      departmentName: queue.department,
      serviceName: queue.service,
      priorityName: queue.priority,
      timestamp: new Date().toLocaleString(),
    }),
  });

  const result = await response.json();
  console.log(`Ticket printed: ${result.ticketNumber}`);
  return result;
};
```

## 📄 License

MIT
