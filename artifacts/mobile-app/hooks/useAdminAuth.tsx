import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AdminAuthContextType {
  adminToken: string | null;
  setAdminToken: (token: string | null) => Promise<void>;
  isLoading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminToken: null,
  setAdminToken: async () => {},
  isLoading: true,
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("adminToken").then((token) => {
      setAdminTokenState(token);
      setIsLoading(false);
    });
  }, []);

  const setAdminToken = async (token: string | null) => {
    setAdminTokenState(token);
    if (token) {
      await AsyncStorage.setItem("adminToken", token);
    } else {
      await AsyncStorage.removeItem("adminToken");
    }
  };

  return (
    <AdminAuthContext.Provider value={{ adminToken, setAdminToken, isLoading }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);
