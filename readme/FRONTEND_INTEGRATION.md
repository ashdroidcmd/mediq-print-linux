# 🎨 Frontend Integration Guide - Print Server

How to integrate the EPSON TM-T82II Print Server with your React frontend.

## 📋 Setup Steps

### Step 1: Environment Configuration

Create `.env.local` in your frontend project:

```env
# Print Server Configuration
VITE_PRINT_SERVER_URL=http://localhost:3002
VITE_PRINT_SERVER_API_PRINT=http://localhost:3002/print
VITE_PRINT_SERVER_API_TEST=http://localhost:3002/test-print
VITE_PRINT_SERVER_API_HEALTH=http://localhost:3002/health

# For production
VITE_PRINT_SERVER_URL_PROD=https://print.yourdomain.com

# Auto print on ticket creation
VITE_AUTO_PRINT_ENABLED=true
```

### Step 2: Create Print Service

Create `src/services/printService.ts`:

```typescript
interface PrintTicketRequest {
  queueNumber: string;
  departmentName: string;
  serviceName: string;
  priorityName?: string;
  timestamp?: string;
  connectionType?: "auto" | "usb" | "tcp";
}

interface PrintResponse {
  success: boolean;
  ticketNumber: string;
  method: "usb" | "tcp";
  bytes: number;
  timestamp: string;
  error?: string;
}

class PrintService {
  private baseUrl: string;

  constructor(baseUrl: string = import.meta.env.VITE_PRINT_SERVER_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Print a queue ticket
   */
  async printTicket(request: PrintTicketRequest): Promise<PrintResponse> {
    const response = await fetch(`${this.baseUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...request,
        timestamp: request.timestamp || new Date().toLocaleString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Print failed");
    }

    return response.json();
  }

  /**
   * Test print
   */
  async testPrint(): Promise<PrintResponse> {
    const response = await fetch(`${this.baseUrl}/test-print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Test print failed");
    }

    return response.json();
  }

  /**
   * Check printer health
   */
  async checkHealth() {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  }

  /**
   * Check if printer is available
   */
  async isPrinterAvailable(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.printer.detected;
    } catch {
      return false;
    }
  }
}

export const printService = new PrintService();
```

### Step 3: Create Print Hook

Create `src/hooks/usePrinter.ts`:

```typescript
import { useState, useCallback } from "react";
import { printService } from "@/services/printService";

interface UsePrinterOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export const usePrinter = (options: UsePrinterOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [printerAvailable, setPrinterAvailable] = useState(false);

  // Check printer availability
  const checkPrinter = useCallback(async () => {
    try {
      const available = await printService.isPrinterAvailable();
      setPrinterAvailable(available);
      return available;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Unknown error"));
      return false;
    }
  }, []);

  // Print ticket
  const print = useCallback(
    async (
      queueNumber: string,
      departmentName: string,
      serviceName: string,
      priorityName?: string,
    ) => {
      setLoading(true);
      setError(null);

      try {
        const result = await printService.printTicket({
          queueNumber,
          departmentName,
          serviceName,
          priorityName,
        });

        options.onSuccess?.(result);
        return result;
      } catch (e) {
        const error = e instanceof Error ? e : new Error("Print failed");
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options],
  );

  // Test print
  const testPrint = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await printService.testPrint();
      options.onSuccess?.(result);
      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error("Test print failed");
      setError(error);
      options.onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [options]);

  return {
    loading,
    error,
    printerAvailable,
    checkPrinter,
    print,
    testPrint,
  };
};
```

### Step 4: Integrate into Queue Management

Example: Queue management component that auto-prints tickets

```typescript
// src/components/QueueManagement.tsx

import { usePrinter } from '@/hooks/usePrinter';
import { message, Button, Modal } from 'antd';

export const QueueManagement = () => {
  const { loading, print, testPrint, checkPrinter } = usePrinter({
    onSuccess: (result) => {
      message.success(`Ticket ${result.ticketNumber} printed`);
    },
    onError: (error) => {
      message.error(`Print failed: ${error.message}`);
    },
  });

  const handleCreateTicket = async (queueData) => {
    try {
      // 1. Create ticket in backend
      const ticket = await createTicketInDB(queueData);

      // 2. Auto-print if enabled
      if (import.meta.env.VITE_AUTO_PRINT_ENABLED === 'true') {
        await print(
          ticket.queueNumber,
          ticket.departmentName,
          ticket.serviceName,
          ticket.priorityName,
        );
      } else {
        // Show manual print button
        Modal.confirm({
          title: 'Print Ticket?',
          content: `Print ticket #${ticket.queueNumber}?`,
          okText: 'Print',
          onOk: async () => {
            await print(
              ticket.queueNumber,
              ticket.departmentName,
              ticket.serviceName,
              ticket.priorityName,
            );
          },
        });
      }
    } catch (error) {
      message.error('Failed to create ticket');
    }
  };

  const handleTestPrint = async () => {
    try {
      await testPrint();
      message.success('Test print sent');
    } catch (error) {
      message.error('Test print failed');
    }
  };

  return (
    <div>
      <Button onClick={handleTestPrint} loading={loading}>
        Test Print
      </Button>
      {/* Queue management UI */}
    </div>
  );
};
```

## 🔌 Printer Status Component

```typescript
// src/components/PrinterStatus.tsx

import { useEffect, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { printService } from '@/services/printService';

export const PrinterStatus = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const health = await printService.checkHealth();
      setStatus(health);
    } catch (error) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin />;

  if (!status?.printer.detected) {
    return (
      <Alert
        message="Printer Not Connected"
        description="The thermal printer is not detected. Check USB cable and power."
        type="error"
        icon={<CloseCircleOutlined />}
        action={<Button onClick={checkStatus}>Retry</Button>}
      />
    );
  }

  const { usb, tcp } = status.printer.connections;

  return (
    <Alert
      message="Printer Connected"
      description={
        <>
          {usb?.available && <div>✓ USB: {usb.device}</div>}
          {tcp?.available && <div>✓ TCP: {tcp.host}:{tcp.port}</div>}
        </>
      }
      type="success"
      icon={<CheckCircleOutlined />}
    />
  );
};
```

## 🚀 Docker Deployment

Add print server to your docker-compose.yml:

```yaml
services:
  # ... existing services ...

  print-server:
    build:
      context: ./test-print-linux
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      PORT: 3002
      CONNECTION_TYPE: tcp
      PRINTER_IP: 192.168.1.100
      PRINTER_PORT: 9100
      DEBUG: "false"
    networks:
      - mediq-network
    restart: unless-stopped

networks:
  mediq-network:
```

### Dockerfile for print-server

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY print-server.js .

EXPOSE 3002

CMD ["node", "print-server.js"]
```

## 📝 Example: Print on Queue Call

```typescript
// Call queue - auto-print to alert zone
const handleCallQueue = async (queueItem) => {
  try {
    // Update database
    await updateQueueStatus(queueItem.id, "called");

    // Auto-print zone signage
    if (import.meta.env.VITE_AUTO_PRINT_ENABLED === "true") {
      await printService.printTicket({
        queueNumber: queueItem.queueNumber,
        departmentName: "ZONE ALERT",
        serviceName: `Call now: ${queueItem.queueNumber}`,
        priorityName: "URGENT",
      });
    }
  } catch (error) {
    console.error("Failed to call queue:", error);
  }
};
```

## 🔒 Security Considerations

1. **CORS Configuration**: Update print server CORS to allow your frontend domain only

```javascript
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:5173",
    ],
  }),
);
```

2. **Authentication**: Add token-based authentication for production

```javascript
app.use("/print", authenticateToken);
```

3. **Rate Limiting**: Prevent print spam

```javascript
const rateLimit = require("express-rate-limit");
const printLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

app.post("/print", printLimiter /* ... */);
```

## 📞 Support

For issues:

1. Check printer detection: `npm run detect`
2. Test server: `npm run server:dev`
3. View server logs: Monitor terminal output
4. Check browser console: Look for network errors
5. Verify connectivity: `curl http://localhost:3002/health`

## 📚 Additional Resources

- [Print Server README](./PRINT_SERVER_README.md)
- [Test Print Script](./test-print.js)
- [EPSON ESC/POS Manual](https://reference.epson-biz.com/)
- [Ubuntu USB Printer Setup](https://help.ubuntu.com/community/Printers)
