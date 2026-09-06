"use client";

import { useState } from "react";
import { HubiMascotOpus, type HubiState3D } from "@/components/hubi/hubi-opus-mascot-3d";
import { Music, ArrowUp, RotateCw, Clapperboard, Trophy, Heart, PartyPopper, Wand2, Smile, ThumbsUp, Moon, Zap, HelpCircle, AlertCircle, Sparkles } from "lucide-react";

const MOODS: { state: HubiState3D; label: string; icon: typeof Music }[] = [
  { state: "idle", label: "Idle", icon: Sparkles },
  { state: "fistPump", label: "FistPump", icon: Trophy },
  { state: "clap", label: "Clap", icon: Clapperboard },
  { state: "dance", label: "Dance", icon: Music },
  { state: "jump", label: "Jump", icon: ArrowUp },
  { state: "spin", label: "Spin", icon: RotateCw },
  { state: "love", label: "Love", icon: Heart },
  { state: "birthday", label: "Birthday", icon: PartyPopper },
  { state: "magic", label: "Magic", icon: Wand2 },
  { state: "wink", label: "Wink", icon: Smile },
  { state: "thumbsUp", label: "ThumbsUp", icon: ThumbsUp },
  { state: "thinking", label: "Thinking", icon: HelpCircle },
  { state: "error", label: "Error", icon: AlertCircle },
  { state: "sleepy", label: "Sleepy", icon: Moon },
  { state: "surprised", label: "Surprised", icon: AlertCircle },
  { state: "charging", label: "Charging", icon: Zap },
  { state: "bow", label: "Bow", icon: HelpCircle },
  { state: "grateful", label: "Grateful", icon: Heart },
];

export default function HubiOpusPage() {
  const [state, setState] = useState<HubiState3D>("idle");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-950 p-8">
      <h1 className="text-2xl font-bold text-white">Hubi Opus — Preview</h1>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <HubiMascotOpus state={state} size={300} />
      </div>

      <div className="flex max-w-2xl flex-wrap justify-center gap-2">
        {MOODS.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.state}
              onClick={() => setState(m.state)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                state === m.state
                  ? "bg-sky-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setState("idle")}
        className="rounded-lg bg-slate-700 px-6 py-2 text-sm font-medium text-white hover:bg-slate-600"
      >
        Reset
      </button>
    </div>
  );
}
