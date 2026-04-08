import { useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';

export const useSignalR = (hubUrl: string) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('token') || '',
      })
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
  }, [hubUrl]);

  useEffect(() => {
    if (connection) {
      connection.start()
        .then(() => console.log('Connected to Hub'))
        .catch(err => console.error('Connection failed: ', err));
    }

    return () => {
      connection?.stop();
    };
  }, [connection]);

  const on = (eventName: string, callback: (...args: any[]) => void) => {
    useEffect(() => {
      if (connection) {
        connection.on(eventName, callback);
        return () => {
          connection.off(eventName, callback);
        };
      }
    }, [connection, eventName, callback]);
  };

  const invoke = async (methodName: string, ...args: any[]) => {
    if (connection) {
      return connection.invoke(methodName, ...args);
    }
  };

  return { on, invoke, connectionState: connection?.state };
};
