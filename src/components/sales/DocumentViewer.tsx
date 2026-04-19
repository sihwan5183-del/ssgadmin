import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Doc {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
}

interface Props {
  doc: Doc | null;
  onClose: () => void;
  /** 워터마크에 표시할 열람자 이름 (기본: 로그인 이메일) */
  viewerName?: string;
}

/**
 * 보안 서류 뷰어
 * - 화면 위에 [열람자명 + 일시] 사선 워터마크 오버레이
 * - 우클릭 / 드래그 / 다운로드 버튼만 별도 제어
 */
export const DocumentViewer = ({ doc, onClose, viewerName }: Props) => {
  const { user } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<string>("");

  const watermark = useMemo(() => {
    const who = viewerName || user?.email || "익명 사용자";
    return `${who} · ${now}`;
  }, [viewerName, user, now]);

  useEffect(() => {
    if (!doc) {
      setSignedUrl(null);
      return;
    }
    setNow(new Date().toLocaleString("ko-KR"));
    const t = setInterval(() => setNow(new Date().toLocaleString("ko-KR")), 60_000);
    setLoading(true);
    supabase.storage
      .from("sale-documents")
      .createSignedUrl(doc.storage_path, 60 * 5)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) {
          toast.error("미리보기 URL 생성 실패");
          onClose();
        } else {
          setSignedUrl(data.signedUrl);
        }
        setLoading(false);
      });
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const handleDownload = () => {
    if (!signedUrl || !doc) return;
    const a = document.createElement("a");
    a.href = signedUrl;
    a.download = doc.file_name;
    a.click();
    toast.info(`다운로드 — ${watermark}`);
  };

  if (!doc) return null;
  const isImg = doc.mime_type?.startsWith("image/");
  const isPdf = doc.mime_type === "application/pdf";

  // 워터마크 패턴 — 화면 전체에 사선 반복 텍스트
  const wmRows = Array.from({ length: 12 });

  return (
    <Dialog open={!!doc} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[88vh] p-0 overflow-hidden flex flex-col gap-0">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 text-primary-glow shrink-0" />
            <span className="text-sm font-medium truncate">{doc.file_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!signedUrl}>
              <Download className="size-3.5 mr-1.5" /> 다운로드
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* 컨텐츠 + 워터마크 오버레이 */}
        <div
          className="relative flex-1 bg-background/80"
          onContextMenu={(e) => e.preventDefault()}
        >
          {loading || !signedUrl ? (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : isImg ? (
            <div className="absolute inset-0 overflow-auto grid place-items-center p-4">
              <img
                src={signedUrl}
                alt={doc.file_name}
                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                draggable={false}
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0`}
              title={doc.file_name}
              className="absolute inset-0 w-full h-full"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
              미리보기를 지원하지 않는 형식입니다. 다운로드 후 확인해주세요.
            </div>
          )}

          {/* 워터마크 오버레이 — 클릭 통과 */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden select-none"
            aria-hidden
          >
            <div
              className="absolute inset-[-30%] flex flex-col gap-20 opacity-[0.08]"
              style={{ transform: "rotate(-22deg)" }}
            >
              {wmRows.map((_, i) => (
                <div
                  key={i}
                  className="whitespace-nowrap text-foreground text-sm font-medium tracking-widest"
                >
                  {Array.from({ length: 6 })
                    .map(() => `🔒 ${watermark}`)
                    .join("     ")}
                </div>
              ))}
            </div>
          </div>

          {/* 하단 보안 안내 */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-background/85 border border-border/50 text-[11px] text-muted-foreground backdrop-blur">
            보안 열람 — {watermark}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
