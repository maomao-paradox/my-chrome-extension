import React, { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Gauge,
  Play,
  RadioTower,
  Search,
  ShieldAlert,
} from "lucide-react";
import GlobeScene, { missionSites } from "./GlobeScene";
import "./styles.css";

const campaigns = [
  {
    id: "01",
    title: "赤色黎明",
    subtitle: "1 // Mental Omega",
  },
  {
    id: "02",
    title: "极夜防线",
    subtitle: "2 // Northern Front",
  },
  {
    id: "03",
    title: "蓝弧协议",
    subtitle: "3 // Pacific Signal",
  },
  {
    id: "04",
    title: "灰烬轨道",
    subtitle: "4 // Orbital Siege",
  },
  {
    id: "05",
    title: "静默风暴",
    subtitle: "5 // Silent Tempest",
  },
  {
    id: "06",
    title: "终端裂隙",
    subtitle: "6 // Terminal Rift",
  },
  {
    id: "07",
    title: "深空回声",
    subtitle: "7 // Deep Echo",
  },
];

const difficultyLevels = ["休闲", "普通", "困难"];

const App: React.FC = () => {
  const [selectedMission, setSelectedMission] = useState(missionSites[0]);

  return (
    <main className="h-screen w-full overflow-hidden bg-[#0f1115] font-sans text-white">
      <div className="flex h-full w-full bg-[radial-gradient(circle_at_50%_50%,rgba(0,180,216,0.12),transparent_34%),linear-gradient(135deg,#111317_0%,#0a0a0a_100%)]">
        <aside className="flex h-full w-[25%] min-w-[300px] flex-col border-r border-white/10 bg-[#111]/75 shadow-[inset_-1px_0_0_rgba(0,180,216,0.08)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 pb-5 pt-5">
            <button className="mb-5 flex cursor-pointer items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8e8e93] transition-colors duration-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/70">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              返回上级
            </button>

            <div className="flex items-center gap-6 text-sm font-semibold uppercase tracking-wider">
              <button className="cursor-pointer border-b-2 border-[#00b4d8] pb-3 text-white transition-colors duration-200">
                战役数据库
              </button>
              <button className="cursor-pointer border-b-2 border-transparent pb-3 text-[#8e8e93] transition-colors duration-200 hover:text-white">
                行动档案
              </button>
            </div>

            <button className="mt-6 flex h-11 w-full cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/[0.045] px-4 text-left text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-colors duration-200 hover:border-[#00b4d8]/60 hover:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/70">
              <span className="uppercase tracking-wider">全部任务</span>
              <ChevronDown
                className="h-4 w-4 text-[#00b4d8]"
                strokeWidth={1.8}
              />
            </button>

            <label className="mt-4 flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-4 backdrop-blur-md focus-within:border-[#00b4d8]/70 focus-within:ring-2 focus-within:ring-[#00b4d8]/20">
              <Search className="h-4 w-4 text-[#8e8e93]" strokeWidth={1.8} />
              <span className="sr-only">搜索任务档案</span>
              <input
                className="h-full w-full bg-transparent text-sm text-white outline-none placeholder:text-[#8e8e93]"
                placeholder="搜索任务档案"
                type="search"
              />
            </label>
          </div>

          <div className="campaign-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  className="group flex w-full cursor-pointer items-center gap-4 rounded-lg border border-transparent bg-transparent px-3 py-4 text-left transition-colors duration-200 hover:border-[#00b4d8]/25 hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/70"
                >
                  <span className="w-9 shrink-0 font-mono text-xs tracking-[0.24em] text-[#00b4d8]">
                    {campaign.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-white">
                      {campaign.title}
                    </span>
                    <span className="mt-1 block truncate font-mono text-xs text-[#8e8e93]">
                      {campaign.subtitle}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-[#00b4d8]/50 bg-[#00b4d8]/15 px-3 py-1 text-xs font-semibold text-[#b9f6ff] opacity-0 shadow-[0_0_18px_rgba(0,180,216,0.15)] transition-opacity duration-200 group-hover:opacity-100">
                    + 关注
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="relative flex h-full w-[55%] flex-col overflow-hidden bg-[#0b0d10]/80">
          <div className="relative z-10 border-b border-white/10 px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#8e8e93]">
              TACTICAL GEOSPATIAL ARRAY
            </p>
            <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wider text-white">
              战区全息投影
              <span className="mx-3 text-[#00b4d8]">/</span>
              TACTICAL GEOSPATIAL ARRAY
            </h1>
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,180,216,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,180,216,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,10,10,0.18)_50%,rgba(10,10,10,0.86)_100%)]" />

          <div className="absolute right-8 top-28 z-20 w-56 rounded-xl border border-white/10 bg-[#111]/55 p-4 shadow-[0_0_32px_rgba(0,180,216,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                战役状态
              </span>
              <RadioTower
                className="h-4 w-4 text-[#00b4d8]"
                strokeWidth={1.8}
              />
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="uppercase tracking-wider text-[#8e8e93]">
                  Sector
                </span>
                <span className="text-white">{selectedMission.sector}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="uppercase tracking-wider text-[#8e8e93]">
                  Operation
                </span>
                <span className="text-white">{selectedMission.operation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wider text-[#8e8e93]">
                  Status
                </span>
                <span className="text-[#00b4d8]">{selectedMission.status}</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-[#8e8e93]">
              Click globe nodes to inspect mission data
            </p>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center px-8">
            <div className="relative aspect-square w-[min(66vh,78%)] overflow-hidden rounded-full border border-[#00b4d8]/35 bg-slate-950/70 shadow-[0_0_70px_rgba(0,180,216,0.2),inset_0_0_46px_rgba(0,180,216,0.1)]">
              <GlobeScene
                selectedMissionId={selectedMission.id}
                onMissionSelect={setSelectedMission}
              />
              <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_42%,transparent_42%,rgba(0,180,216,0.08)_64%,rgba(5,7,10,0.58)_100%)]" />
            </div>
          </div>
        </section>

        <aside className="flex h-full w-[20%] min-w-[260px] flex-col border-l border-white/10 bg-[#111]/90">
          <div className="border-b border-white/10 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00b4d8]">
              MISSION STATUS
            </p>
            <h2 className="mt-3 text-xl font-semibold uppercase tracking-wider text-white">
              {selectedMission.title}
            </h2>
          </div>

          <div className="flex flex-1 flex-col justify-between px-6 py-6">
            <div>
              <p className="text-sm leading-7 text-[#8e8e93]">
                {selectedMission.objective}
              </p>

              <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="uppercase tracking-wider text-[#8e8e93]">
                    Mission
                  </span>
                  <span className="text-white">{selectedMission.id}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="uppercase tracking-wider text-[#8e8e93]">
                    Sector
                  </span>
                  <span className="text-white">{selectedMission.sector}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="uppercase tracking-wider text-[#8e8e93]">
                    Coord
                  </span>
                  <span className="text-white">
                    {selectedMission.coordinates}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-wider text-[#8e8e93]">
                    Risk
                  </span>
                  <span className="text-[#00b4d8]">{selectedMission.risk}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8e8e93]">
                  <Gauge className="h-4 w-4 text-[#00b4d8]" strokeWidth={1.8} />
                  行动难度
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {difficultyLevels.map((level, index) => (
                    <button
                      key={level}
                      className={`flex h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/70 ${
                        level === selectedMission.risk
                          ? "border-[#00b4d8] bg-[#00b4d8]/15 text-white"
                          : "border-white/10 bg-slate-900/60 text-[#8e8e93] hover:border-[#00b4d8]/60 hover:text-white"
                      }`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.8} />
                      <span>{level}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button className="flex h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-[#00b4d8]/45 bg-[#171b21] text-base font-semibold uppercase tracking-wider text-white shadow-[0_0_26px_rgba(0,180,216,0.18),inset_0_0_18px_rgba(0,180,216,0.08)] transition-colors duration-200 hover:border-[#00b4d8] hover:bg-[#1d242b] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/70">
                <Play
                  className="h-5 w-5 fill-[#00b4d8] text-[#00b4d8]"
                  strokeWidth={1.8}
                />
                <span>开始任务</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default App;
