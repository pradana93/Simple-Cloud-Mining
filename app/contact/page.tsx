"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  const [msg, setMsg] = useState<string | null>(null);
  async function submit(formData: FormData) {
    const supabase = createClient();
    const { error } = await supabase.from("contact").insert({
      name: String(formData.get("name")),
      email: String(formData.get("email")),
      subject: String(formData.get("subject")),
      message: String(formData.get("message")),
    });
    setMsg(error ? `Error: ${error.message}` : "Message sent with success!");
  }
  return (
    <div className="mx-auto max-w-xl py-6">
      <Card><CardHeader><CardTitle>Contact us</CardTitle></CardHeader><CardContent>
        <form action={submit} className="space-y-3">
          <div><Label>Name</Label><Input name="name" required /></div>
          <div><Label>Email</Label><Input name="email" type="email" required /></div>
          <div><Label>Subject</Label><Input name="subject" minLength={5} required /></div>
          <div><Label>Message</Label><textarea name="message" minLength={10} required className="w-full rounded-md border p-2" rows={5} /></div>
          <Button type="submit">Send</Button>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </CardContent></Card>
    </div>
  );
}
