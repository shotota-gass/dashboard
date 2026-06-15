"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [userId, setUserId] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Something went wrong.");
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.svg" alt="Shotota Gas" width={80} height={80} className="mb-3" />
          <h1 className="text-xl font-semibold text-gray-800">Reset Password</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Enter your User ID and we'll send a reset link to your email.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">
              If an account with that User ID exists and has an email address on file, a reset link has been sent.
            </p>
            <p className="text-xs text-gray-500">The link expires in 1 hour.</p>
            <Link href="/login" className="block mt-4 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="SG@XX45"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-gray-800 bg-gray-100 border border-gray-300 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                ← Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
