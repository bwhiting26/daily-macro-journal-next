"use client";
import { useState } from "react";
import { Card, CardBody, Input, Button } from "@nextui-org/react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async () => {
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Sign-up successful! Please check your email to confirm your account.");
    }
  };

  const handleSignIn = async () => {
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardBody>
          <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">Login / Sign Up</h1>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {message && <p className="text-green-500 mb-4">{message}</p>}
          <div className="flex flex-col space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs mx-auto"
              aria-label="Email Input"
              classNames={{
                input: "text-gray-900",
                label: "text-gray-900",
              }}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="max-w-xs mx-auto"
              aria-label="Password Input"
              classNames={{
                input: "text-gray-900",
                label: "text-gray-900",
              }}
            />
            <div className="flex space-x-2 justify-center">
              <Button color="primary" onPress={handleSignIn} className="text-gray-900">
                Sign In
              </Button>
              <Button color="secondary" onPress={handleSignUp} className="text-gray-900">
                Sign Up
              </Button>
            </div>
          </div>
          <p className="text-center mt-4">
            <Link href="/" className="text-blue-500 hover:underline">
              Back to Dashboard
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}