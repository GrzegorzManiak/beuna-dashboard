import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ReviewPanelTone } from "./reviewPanelTypes";

type ReviewPanelStatusBannerProps = {
    tone: ReviewPanelTone;
    title: string;
    subtitle: string;
    highlights: string;
    issues: string[];
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

function ReviewPanelStatusBanner({ tone, title, subtitle, highlights, issues }: ReviewPanelStatusBannerProps){
    const visibleIssues = issues.slice(0, 3);
    return (
        <div className={`rounded-xl border px-4 py-4 ${getToneClassName(tone)}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{getToneIcon(tone)}</div>
                <div className="flex-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm opacity-85">{subtitle}</p>
                    <p className="mt-2 text-xs font-medium opacity-80">{highlights}</p>
                    {visibleIssues.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs opacity-85">
                            {visibleIssues.map((issue) => (
                                <li key={issue}>- {issue}</li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

export {
    ReviewPanelStatusBanner,
};
