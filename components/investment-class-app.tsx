"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, BookOpen, ChevronRight, FlaskConical, LayoutDashboard, LogIn, LogOut, Menu, Plus, ShieldCheck, Target, UserPlus, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_CARDS, SHOCKS } from "@/lib/course-data";
import { DEFAULT_ACTIVE_DISTRIBUTION_ID, DEFAULT_DIVIDEND_DISTRIBUTIONS, validateDividendDistributions, type DividendDistribution, type InformationMode, type TradingMode } from "@/lib/market";
import { ClassroomRoom } from "@/components/classroom-room";
import { DividendDistributionEditor } from "@/components/dividend-distribution-editor";
import { MptLab } from "@/components/mpt-lab";
import { RiskTest } from "@/components/risk-test";
import { readJsonResponse } from "@/lib/client-response";

type User = { id: string; username: string; displayName: string; role: string };
type View = "dashboard" | "market" | "allocation" | "mpt" | "risk";
type Room = { id: string; code: string; type: string; title: string; status: string; stage: string; createdAt: string };
type RoomConfigState = {
  rolePool: string[];
  shockPool: string[];
  revision: boolean;
  tradingMode: TradingMode;
  informationMode: InformationMode;
  dividendDistributions: DividendDistribution[];
  activeDistributionId: string;
  rounds: number;
  secondsPerRound: number;
  initialCash: number;
  initialShares: number;
};

function isTeacherRole(role: string) {
  return ["teacher", "instructor", "admin"].includes(role);
}

const modules = [
  { key: "market" as View, lesson: "1차시", title: "실험경제", description: "가격·가치·정보가 만나는 실험자산시장", icon: FlaskConical, color: "from-[#16457f] to-[#2479a4]" },
  { key: "allocation" as View, lesson: "2차시", title: "자산배분", description: "무작위 역할에 맞춘 포트폴리오 설계", icon: Target, color: "from-[#0b7180] to-[#19a09b]" },
  { key: "mpt" as View, lesson: "3차시", title: "MPT", description: "비중을 움직이며 효율적 프론티어 탐색", icon: BarChart3, color: "from-[#6b4aa1] to-[#9672c9]" },
  { key: "risk" as View, lesson: "5차시", title: "투자성향테스트", description: "감내여력·위험선호·원칙준수·투자이해 진단", icon: UserRoundCheck, color: "from-[#b86c0f] to-[#e6a12a]" },
];

export function InvestmentClassApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const logout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      setUser(null);
      setRooms([]);
      setActiveCode(null);
      setView("dashboard");
    }
  };

  useEffect(() => {
    fetch("/api/auth").then((res) => readJsonResponse<{ user?: User }>(res)).then((data) => {
      if (data.user) setUser(data.user);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/rooms").then((res) => readJsonResponse<{ rooms?: Room[] }>(res)).then((data) => setRooms(data.rooms ?? [])).catch(() => undefined);
  }, [user, activeCode]);

  if (loading) return <LoadingScreen />;
  if (!user) return <AccountSetupScreen onComplete={setUser} />;

  const navigate = (next: View) => {
    setActiveCode(null);
    setView(next);
  };
  const title = view === "dashboard" ? "수업 홈" : modules.find((item) => item.key === view)?.title ?? "수업 홈";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[#0f294e] text-white lg:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#f3b63f] text-[#10294e]"><BookOpen className="size-5" /></div>
            <div><p className="font-bold tracking-tight">내 돈 사용 설명서</p><p className="text-xs text-blue-100/70">INVESTMENT CLASS LAB</p></div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="주요 메뉴">
          <NavButton active={view === "dashboard"} icon={LayoutDashboard} label="수업 홈" onClick={() => navigate("dashboard")} />
          {modules.map((item) => <NavButton key={item.key} active={view === item.key} icon={item.icon} label={item.title} meta={item.lesson} onClick={() => navigate(item.key)} />)}
        </nav>
        <AccountPanel user={user} onLogout={() => void logout()} />
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <MobileMenu view={view} navigate={navigate} />
            <div><p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">내 돈 사용 설명서</p><h1 className="text-xl font-bold tracking-tight">{title}</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden rounded-full px-3 py-1 text-sm sm:flex"><span className="mr-2 size-2 rounded-full bg-emerald-500" />{user.displayName}</Badge>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="로그아웃" onClick={() => void logout()}><LogOut /></Button>
          </div>
        </header>

        <main className="lab-grid min-h-[calc(100vh-72px)] px-4 py-6 sm:px-7 sm:py-8">
          {activeCode ? (
            <ClassroomRoom code={activeCode} user={user} onExit={() => { setActiveCode(null); setView("dashboard"); }} />
          ) : view === "dashboard" ? (
            <Dashboard user={user} rooms={rooms} onOpen={setActiveCode} onNavigate={navigate} />
          ) : view === "market" || view === "allocation" ? (
            <RoomStart type={view} user={user} onOpen={setActiveCode} />
          ) : view === "mpt" ? <MptLab /> : <RiskTest />}
        </main>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#0f294e] text-white"><div className="text-center"><Activity className="mx-auto mb-4 size-9 animate-pulse text-[#f3b63f]" /><p className="font-semibold">수업 환경을 준비하고 있습니다</p></div></div>;
}

function AccountSetupScreen({ onComplete }: { onComplete: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [teacherCode, setTeacherCode] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setErrorField(null);

    // Read the actual fields so browser/password-manager autofill also works
    // when it has not dispatched React's onChange event.
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
      displayName: String(data.get("displayName") ?? ""),
      teacherCode: String(data.get("teacherCode") ?? ""),
    };
    setUsername(values.username);
    setPassword(values.password);
    setDisplayName(values.displayName);
    setTeacherCode(values.teacherCode);
    const invalid = (field: string, message: string) => {
      setError(message);
      setErrorField(field);
      (form.elements.namedItem(field) as HTMLInputElement | null)?.focus();
    };
    const normalizedUsername = values.username.trim().normalize("NFKC").toLowerCase();
    if (!normalizedUsername) return invalid("username", "아이디를 입력해주세요.");
    if (!/^[a-z0-9가-힣_-]{4,24}$/u.test(normalizedUsername)) {
      return invalid("username", "아이디는 한글·영문·숫자·밑줄·하이픈으로 4~24자까지 입력해주세요.");
    }
    if (!values.password) return invalid("password", "비밀번호를 입력해주세요.");
    if (values.password.length < 8 || values.password.length > 72) {
      return invalid("password", "비밀번호는 8~72자로 입력해주세요.");
    }
    if (mode === "register" && !values.displayName.trim()) {
      return invalid("displayName", "수업에서 사용할 이름을 입력해주세요.");
    }
    if (mode === "register" && role === "teacher" && !values.teacherCode.trim()) {
      return invalid("teacherCode", "선생님 등록 코드를 입력해주세요. 학생 계정에는 코드가 필요하지 않습니다.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, ...values, role }),
      });
      const data = await readJsonResponse<{ error?: string; user?: User }>(res);
      if (!res.ok) throw new Error(data.error ?? (mode === "login" ? "로그인하지 못했습니다." : "회원가입하지 못했습니다."));
      if (!data.user) throw new Error("처리 결과를 확인하지 못했습니다. 잠시 후 다시 눌러주세요.");
      onComplete(data.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#0f294e] lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="relative flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[#f3b63f] text-[#0f294e]"><BookOpen /></div><div><p className="text-lg font-bold">내 돈 사용 설명서</p><p className="text-sm text-blue-100/70">INVESTMENT CLASS LAB</p></div></div>
        <div className="relative max-w-xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-[#f3b63f]">가격에서 전략까지</p><h1 className="text-5xl font-bold leading-[1.15] tracking-[-0.04em]">직접 선택하고,<br />결과로 이해합니다.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-blue-50/75">실험시장, 역할별 자산배분, MPT와 위험진단이 한 수업 흐름으로 이어집니다.</p></div>
        <div className="relative grid grid-cols-4 gap-3">{["실험경제", "자산배분", "MPT", "위험진단"].map((label, index) => <div key={label} className="border-t border-white/25 pt-3"><span className="text-xs text-blue-100/60">0{index + 1}</span><p className="mt-1 text-sm font-semibold">{label}</p></div>)}</div>
      </section>
      <section className="flex items-center justify-center bg-background p-5 sm:p-10">
        <Card className="w-full max-w-md border-0 shadow-2xl shadow-slate-950/15">
          <CardHeader className="pb-4">
            <Badge className="mb-3 w-fit rounded-full bg-blue-50 text-blue-800 hover:bg-blue-50">내 돈 사용 설명서</Badge>
            <CardTitle className="text-3xl tracking-tight">수업 계정</CardTitle>
            <CardDescription className="text-base">수업용 아이디로 로그인하거나 새 계정을 만드세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(value) => { setMode(value as "login" | "register"); setError(""); setErrorField(null); }}>
              <TabsList className="mb-5 grid h-11 w-full grid-cols-2">
                <TabsTrigger value="login" disabled={busy}><LogIn /> 로그인</TabsTrigger>
                <TabsTrigger value="register" disabled={busy}><UserPlus /> 회원가입</TabsTrigger>
              </TabsList>
            </Tabs>
            <form className="space-y-5" noValidate onSubmit={(event) => void submit(event)}>
              <div className="space-y-2">
                <Label htmlFor="username">아이디</Label>
                <Input id="username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoCapitalize="none" autoComplete="username" maxLength={mode === "register" ? 24 : 254} placeholder="사용할 아이디" aria-invalid={errorField === "username"} aria-describedby={errorField === "username" ? "username-help account-error" : "username-help"} />
                <p id="username-help" className="text-sm text-muted-foreground">한글·영문·숫자·밑줄·하이픈, 4~24자</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input id="password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} maxLength={72} placeholder="비밀번호 입력" aria-invalid={errorField === "password"} aria-describedby={errorField === "password" ? "password-help account-error" : "password-help"} />
                <p id="password-help" className="text-sm text-muted-foreground">8~72자로 입력해주세요.</p>
              </div>
              {mode === "register" && <>
                <div className="space-y-2"><Label htmlFor="name">수업에서 사용할 이름 (필수)</Label><Input id="name" name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoComplete="name" maxLength={40} placeholder="이름 또는 수업용 닉네임" aria-invalid={errorField === "displayName"} aria-describedby={errorField === "displayName" ? "account-error" : undefined} /></div>
                <div className="space-y-2">
                  <Label>계정 유형</Label>
                  <RadioGroup value={role} onValueChange={(value) => setRole(value as "teacher" | "student")} className="grid grid-cols-2 gap-3">
                    <label className={`cursor-pointer rounded-xl border p-4 ${role === "student" ? "border-primary bg-blue-50" : ""}`}><div className="flex items-center gap-2"><RadioGroupItem value="student" /><b>학생</b></div><p className="mt-2 text-xs leading-5 text-muted-foreground">방 코드로 수업에 참여합니다.</p></label>
                    <label className={`cursor-pointer rounded-xl border p-4 ${role === "teacher" ? "border-primary bg-blue-50" : ""}`}><div className="flex items-center gap-2"><RadioGroupItem value="teacher" /><b>선생님</b></div><p className="mt-2 text-xs leading-5 text-muted-foreground">방을 만들고 활동을 진행합니다.</p></label>
                  </RadioGroup>
                </div>
                {role === "teacher" && <div className="space-y-2"><Label htmlFor="teacher-code">선생님 등록 코드</Label><Input id="teacher-code" name="teacherCode" type="password" value={teacherCode} onChange={(event) => setTeacherCode(event.target.value)} required autoComplete="off" placeholder="관리자가 정한 등록 코드" aria-invalid={errorField === "teacherCode"} aria-describedby={errorField === "teacherCode" ? "account-error" : undefined} /></div>}
              </>}
              {error && <p id="account-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              <Button className="h-12 w-full text-base" type="submit" disabled={busy} aria-busy={busy}>
                {busy ? "처리 중…" : mode === "login" ? "로그인" : "계정 만들기"}
              </Button>
              <p className="text-center text-xs leading-5 text-muted-foreground">수업 결과는 투자 권유가 아닌 교육용 기록입니다.</p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Dashboard({ user, rooms, onOpen, onNavigate }: { user: User; rooms: Room[]; onOpen: (code: string) => void; onNavigate: (view: View) => void }) {
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState(user.displayName);
  const [error, setError] = useState("");
  const join = async () => {
    setError("");
    const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", code: joinCode, nickname }) });
    const data = await readJsonResponse<{ error?: string; code: string }>(res);
    if (!res.ok) setError(data.error ?? "입장하지 못했습니다."); else onOpen(data.code);
  };
  return (
    <div className="mx-auto max-w-[1220px] space-y-7 fade-up">
      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="relative overflow-hidden rounded-[24px] bg-[#123a6d] p-7 text-white shadow-xl shadow-blue-950/10 sm:p-9">
          <div className="absolute -right-14 -top-16 size-56 rounded-full border border-white/10" /><div className="absolute -right-2 top-8 size-32 rounded-full border border-[#f3b63f]/40" />
          <Badge className="mb-5 bg-white/10 text-blue-50 hover:bg-white/10">오늘의 수업</Badge>
          <h2 className="max-w-xl text-3xl font-bold tracking-[-0.03em] sm:text-4xl">방 코드를 입력하고<br />현재 활동에 참여하세요.</h2>
          <div className="mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
            <Input aria-label="방 코드" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} placeholder="6자리 코드" className="h-12 border-white/20 bg-white text-lg font-bold uppercase tracking-[0.18em] text-slate-900 placeholder:font-normal placeholder:tracking-normal" />
            <Input aria-label="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="닉네임" className="h-12 border-white/20 bg-white text-slate-900" />
            <Button className="h-12 shrink-0 bg-[#f3b63f] px-6 text-[#10294e] hover:bg-[#ffc953]" onClick={() => void join()}>입장하기 <ChevronRight /></Button>
          </div>
          {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
        </div>
        <Card className="border-0 shadow-lg shadow-slate-900/5"><CardHeader><div className="mb-2 grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck /></div><CardTitle>내 학습 기록</CardTitle><CardDescription>차시별 결과는 본인 계정에만 저장됩니다.</CardDescription></CardHeader><CardContent className="space-y-3"><RecordLine label="참여한 수업방" value={`${rooms.length}개`} /><RecordLine label="포트폴리오 1.0" value="MPT에서 저장" /><RecordLine label="위험진단" value="개인별 진행" /></CardContent></Card>
      </section>
      <section><div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-semibold text-primary">LEARNING LABS</p><h2 className="text-2xl font-bold tracking-tight">수업 도구</h2></div><p className="hidden text-sm text-muted-foreground sm:block">원하는 도구는 개인적으로 다시 실행할 수 있습니다.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{modules.map((item) => <button key={item.key} onClick={() => onNavigate(item.key)} className={`module-card min-h-56 rounded-[22px] bg-gradient-to-br ${item.color} p-6 text-left text-white shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40`}><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-white/15"><item.icon /></span><span className="text-sm font-semibold text-white/65">{item.lesson}</span></div><h3 className="mt-9 text-2xl font-bold">{item.title}</h3><p className="mt-2 max-w-[15rem] text-sm leading-6 text-white/75">{item.description}</p><div className="mt-5 flex items-center gap-1 text-sm font-semibold">열기 <ChevronRight className="size-4" /></div></button>)}</div></section>
      {rooms.length > 0 && <section><h2 className="mb-4 text-xl font-bold">최근 수업방</h2><div className="grid gap-3 md:grid-cols-2">{rooms.slice(0, 4).map((room) => <button key={room.id} onClick={() => onOpen(room.code)} className="flex items-center justify-between rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"><div><div className="flex items-center gap-2"><Badge variant="secondary">{room.type === "market" ? "실험경제" : "자산배분"}</Badge><span className="text-sm text-muted-foreground">{room.status === "complete" ? "종료" : "진행 중"}</span></div><p className="mt-2 font-bold">{room.title}</p><p className="mt-1 text-sm text-muted-foreground">코드 {room.code}</p></div><ChevronRight className="text-muted-foreground" /></button>)}</div></section>}
    </div>
  );
}

function RoomStart({ type, user, onOpen }: { type: "market" | "allocation"; user: User; onOpen: (code: string) => void }) {
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);
  const [title, setTitle] = useState(type === "market" ? "실험자산시장" : "역할별 자산배분");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState(user.displayName);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<RoomConfigState>({
    rolePool: ROLE_CARDS.map((role) => role.key),
    shockPool: SHOCKS.map((shock) => shock.key),
    revision: true,
    tradingMode: "close_public",
    informationMode: "full_distribution",
    dividendDistributions: DEFAULT_DIVIDEND_DISTRIBUTIONS.map((distribution) => ({ ...distribution, outcomes: distribution.outcomes.map((outcome) => ({ ...outcome })) })),
    activeDistributionId: DEFAULT_ACTIVE_DISTRIBUTION_ID,
    rounds: 10,
    secondsPerRound: 60,
    initialCash: 50,
    initialShares: 5,
  });
  const distributionError = validateDividendDistributions(config.dividendDistributions);
  const activeDistributionValid = config.dividendDistributions.some((distribution) => distribution.id === config.activeDistributionId);
  const canCreate = isTeacherRole(user.role);
  const toggle = (key: "rolePool" | "shockPool", value: string) => {
    setConfig((current) => {
      const values = current[key];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };
  const submit = async () => {
    if (dialog === "create" && type === "market" && (distributionError || !activeDistributionValid)) {
      setError(distributionError ?? "이번 방에서 사용할 배당확률분포를 선택해주세요.");
      return;
    }
    const body = dialog === "create" ? { action: "create", type, title, config } : { action: "join", code, nickname };
    const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await readJsonResponse<{ error?: string; code: string }>(res);
    if (!res.ok) setError(data.error ?? "요청을 처리하지 못했습니다.");
    else { setDialog(null); onOpen(data.code); }
  };
  const copy = type === "market"
    ? { eyebrow: "1차시 · 가격은 왜 가치와 다를까?", title: "시장에서 직접 가격을 만듭니다.", steps: ["거래·정보 공개 방식 선택", "배당확률분포 직접 설정", "장 마감 동시체결"] }
    : { eyebrow: "2차시 · 안전자산은 정말 안전할까?", title: "내 역할에 맞는 자산배분을 설계합니다.", steps: ["학생별 역할 무작위 배정", "100포인트 최초 배분", "선택 이유 기록"] };
  const createDisabled = type === "allocation"
    ? !config.rolePool.length || !config.shockPool.length
    : Boolean(distributionError) || !activeDistributionValid;

  return <div className="mx-auto max-w-5xl fade-up">
    <section className="overflow-hidden rounded-[28px] border bg-card shadow-xl shadow-slate-900/5">
      <div className="grid md:grid-cols-[1.2fr_0.8fr]">
        <div className="p-7 sm:p-10">
          <p className="text-sm font-bold text-primary">{copy.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{copy.title}</h2>
          <div className="mt-8 flex flex-wrap gap-3">{canCreate && <Button size="lg" onClick={() => { setError(""); setDialog("create"); }}><Plus /> 방 만들기</Button>}<Button size="lg" variant={canCreate ? "outline" : "default"} onClick={() => { setError(""); setDialog("join"); }}>코드로 참여</Button></div>
          {!canCreate && <p className="mt-4 text-sm text-muted-foreground">학생 계정은 선생님이 공유한 코드로 참여할 수 있습니다.</p>}
        </div>
        <div className="bg-[#10294e] p-7 text-white sm:p-10"><p className="text-sm font-semibold text-[#f3b63f]">수업 기본 설정</p><div className="mt-6 space-y-5">{copy.steps.map((step, index) => <div key={step} className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/20 text-sm">{index + 1}</span><p className="pt-1 font-medium">{step}</p></div>)}</div></div>
      </div>
    </section>
    <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{dialog === "create" ? "수업방 만들기" : "수업방 참여하기"}</DialogTitle><DialogDescription>{dialog === "create" ? "이 방에서 사용할 조건을 자유롭게 설정하세요." : "선생님이 공유한 6자리 코드와 닉네임을 입력하세요."}</DialogDescription></DialogHeader>
        <div className="space-y-5 py-2">
          {dialog === "create" ? <>
            <div className="space-y-2"><Label htmlFor="room-title">방 이름</Label><Input id="room-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
            {type === "allocation" ? <>
              <ChoiceGroup title="무작위 역할" description="선택한 역할을 학생 수에 맞춰 균등하게 섞습니다.">{ROLE_CARDS.map((role) => <Choice key={role.key} checked={config.rolePool.includes(role.key)} onChange={() => toggle("rolePool", role.key)} label={role.label} detail={role.horizon} />)}</ChoiceGroup>
              <ChoiceGroup title="시장상황 추첨 풀" description="최초 제출이 잠긴 뒤 이 목록에서 하나를 추첨합니다.">{SHOCKS.map((shock) => <Choice key={shock.key} checked={config.shockPool.includes(shock.key)} onChange={() => toggle("shockPool", shock.key)} label={shock.label} detail={`물가 ${shock.inflation}%`} />)}</ChoiceGroup>
              <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>상황 공개 후 1회 수정</Label><p className="text-xs text-muted-foreground">최초안과 수정안을 모두 보존합니다.</p></div><Switch checked={config.revision} onCheckedChange={(revision) => setConfig({ ...config, revision })} /></div>
            </> : <>
              <ChoiceGroup title="거래·호가 공개 방식" description="이 방 전체에 적용할 주문 공개 범위를 하나 선택합니다.">
                <ModeChoice value="private" selected={config.tradingMode} onChange={(tradingMode) => setConfig((current) => ({ ...current, tradingMode }))} label="비공개" detail="학생끼리 호가 미공개" />
                <ModeChoice value="close_public" selected={config.tradingMode} onChange={(tradingMode) => setConfig((current) => ({ ...current, tradingMode }))} label="장 마감마다 공개" detail="거래 중 비공개" />
                <ModeChoice value="open_book" selected={config.tradingMode} onChange={(tradingMode) => setConfig((current) => ({ ...current, tradingMode }))} label="호가창 공개" detail="거래 중 실시간 공개" />
              </ChoiceGroup>
              <ChoiceGroup title="배당정보 공개 방식" description="학생에게 보여줄 배당 관련 정보의 범위를 선택합니다.">
                <InfoChoice value="full_distribution" selected={config.informationMode} onChange={(informationMode) => setConfig((current) => ({ ...current, informationMode }))} label="확률분포 전체" detail="배당금과 확률 공개" />
                <InfoChoice value="expected_only" selected={config.informationMode} onChange={(informationMode) => setConfig((current) => ({ ...current, informationMode }))} label="기대값만" detail="분포표는 비공개" />
                <InfoChoice value="hidden" selected={config.informationMode} onChange={(informationMode) => setConfig((current) => ({ ...current, informationMode }))} label="비공개" detail="배당정보 미제공" />
              </ChoiceGroup>
              <DividendDistributionEditor distributions={config.dividendDistributions} activeDistributionId={config.activeDistributionId} onDistributionsChange={(dividendDistributions) => setConfig((current) => ({ ...current, dividendDistributions }))} onActiveDistributionChange={(activeDistributionId) => setConfig((current) => ({ ...current, activeDistributionId }))} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-2"><Label htmlFor="initial-cash">초기 현금($)</Label><Input id="initial-cash" type="number" min={0} max={1000} step={1} value={config.initialCash} onChange={(event) => setConfig({ ...config, initialCash: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label htmlFor="initial-shares">초기 주식(주)</Label><Input id="initial-shares" type="number" min={1} max={100} step={1} value={config.initialShares} onChange={(event) => setConfig({ ...config, initialShares: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label htmlFor="rounds">장 수</Label><Input id="rounds" type="number" min={1} max={30} value={config.rounds} onChange={(event) => setConfig({ ...config, rounds: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label htmlFor="seconds">장당 시간(초)</Label><Input id="seconds" type="number" min={30} max={180} value={config.secondsPerRound} onChange={(event) => setConfig({ ...config, secondsPerRound: Number(event.target.value) })} /></div>
              </div>
            </>}
          </> : <>
            <div className="space-y-2"><Label htmlFor="room-code">방 코드</Label><Input id="room-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={6} className="text-lg font-bold tracking-[0.15em]" /></div>
            <div className="space-y-2"><Label htmlFor="nickname">닉네임</Label><Input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} /></div>
          </>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>취소</Button><Button onClick={() => void submit()} disabled={dialog === "create" && createDisabled}>{dialog === "create" ? "설정으로 방 생성" : "입장"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function ChoiceGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <fieldset className="rounded-xl border p-4"><legend className="px-1 font-bold">{title}</legend><p className="mb-3 text-xs text-muted-foreground">{description}</p><div className="grid gap-2 sm:grid-cols-2">{children}</div></fieldset>; }
function Choice({ checked, onChange, label, detail }: { checked: boolean; onChange: () => void; label: string; detail: string }) { return <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${checked ? "border-primary bg-blue-50" : ""}`}><Checkbox checked={checked} onCheckedChange={onChange} /><span className="flex-1 text-sm font-semibold">{label}</span><span className="text-xs text-muted-foreground">{detail}</span></label>; }
function ModeChoice({ value, selected, onChange, label, detail }: { value: TradingMode; selected: TradingMode; onChange: (value: TradingMode) => void; label: string; detail: string }) { return <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected === value ? "border-primary bg-blue-50" : ""}`}><input type="radio" name="trading-mode" value={value} checked={selected === value} onChange={() => onChange(value)} className="size-4 accent-blue-700" /><span className="flex-1 text-sm font-semibold">{label}</span><span className="text-xs text-muted-foreground">{detail}</span></label>; }
function InfoChoice({ value, selected, onChange, label, detail }: { value: InformationMode; selected: InformationMode; onChange: (value: InformationMode) => void; label: string; detail: string }) { return <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected === value ? "border-primary bg-blue-50" : ""}`}><input type="radio" name="information-mode" value={value} checked={selected === value} onChange={() => onChange(value)} className="size-4 accent-blue-700" /><span className="flex-1 text-sm font-semibold">{label}</span><span className="text-xs text-muted-foreground">{detail}</span></label>; }

function NavButton({ active, icon: Icon, label, meta, onClick }: { active: boolean; icon: typeof Activity; label: string; meta?: string; onClick: () => void }) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium transition ${active ? "bg-white/12 text-white" : "text-blue-100/70 hover:bg-white/7 hover:text-white"}`}><Icon className={`size-5 ${active ? "text-[#f3b63f]" : ""}`} /><span className="flex-1">{label}</span>{meta && <span className="text-xs text-blue-100/45">{meta}</span>}</button>; }
function AccountPanel({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <div className="border-t border-white/10 p-4">
    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
      <div className="grid size-9 place-items-center rounded-full bg-blue-200/15 font-bold text-blue-100">{user.displayName.slice(0, 1)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{user.displayName}</p>
        <p className="truncate text-xs text-blue-100/50">{isTeacherRole(user.role) ? "선생님" : "학생"}</p>
      </div>
      <button aria-label="로그아웃" onClick={onLogout} className="rounded-lg p-2 text-blue-100/50 hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button>
    </div>
  </div>;
}
function RecordLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-border/70 py-2.5 last:border-0"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-semibold">{value}</span></div>; }
function MobileMenu({ view, navigate }: { view: View; navigate: (view: View) => void }) { const links = [{ key: "dashboard" as View, label: "수업 홈", icon: LayoutDashboard }, ...modules.map(({ key, title: label, icon }) => ({ key, label, icon }))]; return <Sheet><SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[300px] bg-[#0f294e] text-white"><SheetTitle className="px-4 pt-3 text-left text-white">내 돈 사용 설명서</SheetTitle><nav className="mt-6 space-y-1 px-2">{links.map((link) => <NavButton key={link.key} active={view === link.key} icon={link.icon} label={link.label} onClick={() => navigate(link.key)} />)}</nav></SheetContent></Sheet>; }
