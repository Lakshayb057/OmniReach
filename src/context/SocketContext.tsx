import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  lastEvent: any;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<any>(null);

  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('BROADCAST_UPDATED', (data) => {
      setLastEvent({ type: 'BROADCAST_UPDATED', data, timestamp: Date.now() });
    });

    socketInstance.on('BAILEYS_STATUS', (data) => {
      setLastEvent({ type: 'BAILEYS_STATUS', data, timestamp: Date.now() });
    });

    socketInstance.on('BAILEYS_QR', (data) => {
      setLastEvent({ type: 'BAILEYS_QR', data, timestamp: Date.now() });
    });

    socketInstance.on('BAILEYS_PAIRING_CODE', (data) => {
      setLastEvent({ type: 'BAILEYS_PAIRING_CODE', data, timestamp: Date.now() });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, lastEvent }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
