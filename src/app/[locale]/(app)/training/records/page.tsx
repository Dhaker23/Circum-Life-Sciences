"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const TR_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { SCHEDULED: "outline", COMPLETED: "default", EXPIRED: "secondary" };
export default function TrainingRecordsPage() {
  const t = useTranslations("training");
  const { data, isLoading } = useQuery({ queryKey: ["training-records"], queryFn: async () => { const res = await fetch("/api/training/records?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; status: string; employee: { fullName: string }; requiredTraining: { title: string } | null; assessment: { result: string } | null }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("records.title")}</h1><p className="text-sm text-muted-foreground">{t("records.subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("records.title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Code</TableHead><TableHead>Employee</TableHead><TableHead>Training</TableHead><TableHead>Assessment</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.map((r) => (<TableRow key={r.id}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell className="text-xs">{r.employee.fullName}</TableCell><TableCell className="text-xs">{r.requiredTraining?.title ?? "-"}</TableCell><TableCell className="text-xs">{r.assessment?.result ?? "-"}</TableCell><TableCell><Badge variant={TR_VARIANT[r.status] ?? "outline"}>{r.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">No training records found</p>}</CardContent></Card></div>);
}
