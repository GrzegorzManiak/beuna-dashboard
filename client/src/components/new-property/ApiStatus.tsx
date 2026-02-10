import { useEffect, useRef, useState } from "react";
import { useApiStatusMutation } from "@/api/help";
import { cn } from "@/lib/utils";

type ApiStatusProps = {
    className?: string;
};

export function ApiStatus({ className }: ApiStatusProps) {
    const hasRequestedRef = useRef<boolean>(false);
    const { mutateAsync } = useApiStatusMutation();
    const [label, setLabel] = useState<string>("Connecting to API...");
    const [tone, setTone] = useState<string>("text-gray-500");

    useEffect(() => {
        if (hasRequestedRef.current) return;
        hasRequestedRef.current = true;
        const run = async () => {
            try {
                const result = await mutateAsync();
                setLabel(result ? `${result.api.title} v${result.api.version}` : "API connected");
                setTone("text-emerald-700");
            } catch (error) {
                const message = error instanceof Error ? `API unavailable: ${error.message}` : "API unavailable";
                setLabel(message);
                setTone("text-red-600");
            }
        };
        void run();
    }, [mutateAsync]);

    return <div className={cn("text-xs font-medium", tone, className)}>{label}</div>;
}
