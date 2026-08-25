"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const SAMPLE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { DRAWN: "outline", RECEIVED_IN_LAB: "secondary", IN_TEST: "default", CONSUMED: "secondary", RETAINED: "secondary" };
export default function SamplesPage() {
  const t = useTranslations("lab");
  const { data, isLoading } = useQuery({ queryKey: ["samples"], queryFn: async () => { const res = await fetch("/api/lab/samples?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; sourceEntityType: string; status: string; site: { code: string } }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("samples.title")}</h1><p className="text-sm text-muted-foreground">{t("samples.subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("samples.title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>{t("samples.code")}</TableHead><TableHead>{t("samples.source")}</TableHead><TableHead>{t("samples.site")}</TableHead><TableHead>{t("common.status")}</TableHead></TableRow></TableHeader><TableBody>{data.map((s) => (<TableRow key={s.id}><TableCell className="font-mono text-xs">{s.code}</TableCell><TableCell className="text-xs font-mono">{s.sourceEntityType}</TableCell><TableCell className="font-mono text-xs">{s.site.code}</TableCell><TableCell><Badge variant={SAMPLE_VARIANT[s.status] ?? "outline"}>{s.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">{t("samples.noData")}</p>}</CardContent></Card></div>);
}
