import { useState, useEffect, useRef } from 'react';
import { DeviceList } from './DeviceList';
import { useSignalR } from '../lib/SignalRContext';

export function DeviceHub() {
  const { connectSignalR } = useSignalR();
  const [hubUrl, setHubUrl] = useState('');
  const hasConnected = useRef(false);
  
  // Load hub URL from .env or localStorage on component mount
  useEffect(() => {
    const envHubUrl = import.meta.env.VITE_HUB_URL;
    const savedHubUrl = localStorage.getItem('hubUrl');
    
    if (envHubUrl) {
      setHubUrl(envHubUrl);
      localStorage.setItem('hubUrl', envHubUrl);
    } else if (savedHubUrl) {
      setHubUrl(savedHubUrl);
    } else {
      // Default hub URL if none is saved or in .env
      const defaultUrl = `${window.location.origin}/hub`;
      setHubUrl(defaultUrl);
      localStorage.setItem('hubUrl', defaultUrl);
    }
  }, []);

  // Connect only once when component mounts and hubUrl is available
  useEffect(() => {
    if (hubUrl && !hasConnected.current) {
      hasConnected.current = true;
      connectSignalR(hubUrl).catch(err => {
        console.error('Failed to connect to hub:', err);
      });
    }
  }, [hubUrl, connectSignalR]);

  return (
    <div className="container py-4">
      <DeviceList />
    </div>
  );
} 