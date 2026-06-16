"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { requestLogger, installFetchInterceptor, uninstallFetchInterceptor } from "@/lib/request-logger";
import { RequestLogViewer } from "@/components/request-log-viewer";

export function DashboardClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [logEnabled, setLogEnabled] = useState(() => requestLogger.getEnabled());

  useEffect(() => {
    if (requestLogger.getEnabled()) {
      installFetchInterceptor();
    }
    return requestLogger.subscribeEnabled((v) => {
      setLogEnabled(v);
      if (v) {
        installFetchInterceptor();
      } else {
        uninstallFetchInterceptor();
      }
    });
  }, []);

  useEffect(() => {
    if (!requestLogger.getEnabled()) return;
    requestLogger.startPageSession(pathname);
    return () => {
      requestLogger.endPageSession();
    };
  }, [pathname]);

  return (
    <>
      {children}
      {logEnabled && <RequestLogViewer />}
    </>
  );
}
