"use client";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const LoginPage = () => {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  useEffect(() => {
    const provider = searchParams.get("provider");
    if (session?.user[`${provider}Id`]) {
      return window.close();
    }
    signIn(searchParams.get("provider") || "");
  }, [session, status, searchParams.get("provider")]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "absolute",
        left: 0,
        top: 0,
        background: "white",
      }}
    ></div>
  );
};

export default LoginPage;
