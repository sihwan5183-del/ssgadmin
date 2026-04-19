import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStores } from "@/hooks/useStores";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, Image as ImageIcon, Trash2, Eye, Loader2, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  saleId: string;
  saleMeta?: {
    open_date?: string | null;
    customer_name?: string | null;
    store_id?: string | null;
  };
  /** 파일 업로드 후 폴더 라벨에 사용할 매장명 폴백 */
  storeNameFallback?: string;
  /** 읽기 전용 (업로드 비활성화) */
  readOnly?: boolean;
}

interface Doc {
  id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  doc_type: string | null;
  uploaded_by: string;
  created_at: string;
}

const ACCEPT = "image/*,application/pdf";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const sanitize = (s: string) =>
  (s || "").replace(/[\\/:*?"<>|\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

export const SaleDocuments = ({ saleId, saleMeta, storeNameFallback, readOnly }: Props) => {
  const { user } = useAuth();
  const { byId } = useStores();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sale_documents")
      .select("*")
      .eq("sale_id", saleId)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  }, [saleId]);

  useEffect(() => {
    load();
  }, [load]);

  const buildFolder = () => {
    const date = (saleMeta?.open_date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const store =
      sanitize(byId(saleMeta?.store_id ?? null)?.name ?? storeNameFallback ?? "매장") || "매장";
    const customer = sanitize(saleMeta?.customer_name || "고객");
    return `${date}_${store}_${customer}`;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!user) return toast.error("로그인이 필요합니다");
    const list = Array.from(files);
    if (list.length === 0) return;

    const folder = buildFolder();
    setUploading(true);
    let ok = 0;
    for (const file of list) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} — 20MB 초과로 건너뜁니다`);
        continue;
      }
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const ts = Date.now();
      const safeName = sanitize(file.name.replace(/\.[^.]+$/, "")) || "file";
      const path = `${folder}/${ts}_${safeName}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("sale-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`${file.name} 업로드 실패: ${upErr.message}`);
        continue;
      }
      const { error: dbErr } = await supabase.from("sale_documents").insert({
        sale_id: saleId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (dbErr) {
        await supabase.storage.from("sale-documents").remove([path]);
        toast.error(`${file.name} 저장 실패: ${dbErr.message}`);
        continue;
      }
      ok++;
    }
    setUploading(false);
    if (ok > 0) toast.success(`${ok}개 파일이 업로드되었습니다`);
    if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const view = async (doc: Doc) => {
    const { data, error } = await supabase.storage
      .from("sale-documents")
      .createSignedUrl(doc.storage_path, 60 * 5);
    if (error || !data?.signedUrl) return toast.error("미리보기 URL 생성 실패");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (doc: Doc) => {
    if (!confirm(`${doc.file_name} 삭제하시겠습니까?`)) return;
    const { error: dbErr } = await supabase.from("sale_documents").delete().eq("id", doc.id);
    if (dbErr) return toast.error(dbErr.message);
    await supabase.storage.from("sale-documents").remove([doc.storage_path]);
    toast.success("삭제되었습니다");
    load();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (readOnly) return;
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-all",
            dragActive
              ? "border-primary bg-primary/10"
              : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 업로드 중…
            </div>
          ) : (
            <>
              <FileUp className="size-6 mx-auto text-primary-glow mb-2" />
              <div className="text-sm font-medium">
                여기에 파일을 끌어다 놓거나 클릭해서 업로드
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                이미지 · PDF · 최대 20MB · 자동으로{" "}
                <code className="px-1 rounded bg-muted/60 text-[10px]">{buildFolder()}</code> 폴더에
                저장됩니다
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">업로드된 서류 {docs.length > 0 && <span className="text-muted-foreground">({docs.length})</span>}</h4>
        </div>
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-4">불러오는 중…</div>
        ) : docs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4 border border-dashed border-border/40 rounded-lg">
            업로드된 서류가 없습니다
          </div>
        ) : (
          <ul className="space-y-1.5">
            {docs.map((d) => {
              const isImg = d.mime_type?.startsWith("image/");
              const Icon = isImg ? ImageIcon : FileText;
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-card/40"
                >
                  <div className="size-9 rounded-lg bg-muted/40 grid place-items-center shrink-0">
                    <Icon className="size-4 text-primary-glow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.file_name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      {d.file_size && <span>{(d.file_size / 1024).toFixed(0)} KB</span>}
                      <span>·</span>
                      <span>
                        {new Date(d.created_at).toLocaleString("ko-KR", {
                          month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {isImg ? "이미지" : "PDF"}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => view(d)} title="미리보기">
                    <Eye className="size-3.5" />
                  </Button>
                  {!readOnly && (user?.id === d.uploaded_by) && (
                    <Button size="sm" variant="ghost" onClick={() => remove(d)} title="삭제">
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
