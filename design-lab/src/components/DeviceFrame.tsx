import type { ReactNode } from 'react';

interface DeviceFrameProps {
  children: ReactNode;
}

export function DeviceFrame({ children }: DeviceFrameProps) {
  return (
    <div className="device-shell">
      <div className="device">
        <div className="device-screen">
          <div className="dynamic-island" />
          {children}
          <div className="home-indicator" />
        </div>
      </div>
    </div>
  );
}
