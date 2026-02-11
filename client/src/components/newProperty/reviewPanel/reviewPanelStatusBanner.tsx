import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ReviewPanelIssue, ReviewPanelTone } from "./reviewPanelTypes";

type ReviewPanelStatusBannerProps = {
    tone: ReviewPanelTone;
    title: string;
    subtitle: string;
    issues: ReviewPanelIssue[];
};

function getToneClassName(tone: ReviewPanelTone ){
    if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
    return "border-red-200 bg-red-50 text-red-900";
}

function getToneIcon(tone: ReviewPanelTone ){
    if (tone === "success") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    if (tone === "warning") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
}

function ReviewPanelStatusBanner({ tone, title, subtitle, issues }: ReviewPanelStatusBannerProps){
    const handleIssueClick = (id?: string) => {
        if (!id) return;
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <div className={`rounded-xl border px-4 py-4 ${getToneClassName(tone)}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{getToneIcon(tone)}</div>
                <div className="flex-1">
                    <p className="text-sm font-semibold">{title}</p>
                    {subtitle && <p className="mt-1 text-sm opacity-85">{subtitle}</p>}
                    
                    {issues.length > 0 && (
                        <div className="mt-3">
                             <p className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-90">Blocking Issues</p>
                             <ul className="space-y-1">
                                {issues.map((issue, idx) => (
                                    <li key={idx}>
                                        <button
                                            type="button"
                                            onClick={() => handleIssueClick(issue.scrollToId)}
                                            className={`text-left text-sm hover:underline ${issue.scrollToId ? "cursor-pointer" : "cursor-default"}`}
                                        >
                                            • {issue.message}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export {
    ReviewPanelStatusBanner,
};
