import { useCallback, useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsersQuery } from "@/hooks/useUsersQuery";
import type { UserSummary } from "@/hooks/useUsersQuery";
import { useCreateSessionMutation } from "@/hooks/useCreateSessionMutation";
import { getSessionId, getSessionUserId, setSessionId, setSessionUserId } from "@/lib/sessionStorage";
import { cn } from "@/lib/utils";

const DEFAULT_USER_EMAIL = "manager1@buena.local";

type SessionSelectorProps = {
    className?: string;
};

export function SessionSelector({ className }: SessionSelectorProps) {
    const { data, isLoading, isError, error } = useUsersQuery();
    const { mutateAsync, isPending } = useCreateSessionMutation();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(getSessionUserId());
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusTone, setStatusTone] = useState<string>("text-gray-500");

    const users = data?.users ?? [];
    const selectedUser = useMemo(
        () => users.find((user) => user.id === selectedUserId) ?? null,
        [users, selectedUserId],
    );

    const handleSelectUser = useCallback(async (user: UserSummary): Promise<void> => {
        setStatusMessage(null);
        setSelectedUserId(user.id);
        setSessionUserId(user.id);
        try {
            const session = await mutateAsync(user.id);
            setSessionId(session.sessionId);
            setStatusMessage(`Session: ${user.name}`);
            setStatusTone("text-emerald-700");
        } catch (sessionError) {
            const message = sessionError instanceof Error ? sessionError.message : "Failed to create session";
            setStatusMessage(message);
            setStatusTone("text-red-600");
        }
    }, [mutateAsync]);

    useEffect(() => {
        if (users.length === 0) return;
        const storedId = getSessionUserId();
        const storedSessionId = getSessionId();
        const storedUser = users.find((user) => user.id === storedId);
        if (storedUser) {
            if (!selectedUserId) setSelectedUserId(storedUser.id);
            if (!storedSessionId) void handleSelectUser(storedUser);
            return;
        }

        if (selectedUserId) {
            const selected = users.find((user) => user.id === selectedUserId);
            const existingSessionId = getSessionId();
            if (selected && !existingSessionId) void handleSelectUser(selected);
            return;
        }

        const defaultUser = users.find((user) => user.email === DEFAULT_USER_EMAIL)
            ?? users.find((user) => user.role === "MANAGER")
            ?? users[0];

        if (!defaultUser) return;
        void handleSelectUser(defaultUser);
    }, [handleSelectUser, selectedUserId, users]);

    const selectValue = selectedUser?.id ?? "";
    return (
        <div className={cn("rounded-lg border border-gray-200 bg-white/90 px-3 py-2 shadow-sm", className)}>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Session</div>
            <div className="mt-1 flex flex-col gap-2">
                <Select value={selectValue} onValueChange={(value) => {
                    const user = users.find((item) => item.id === value);
                    if (!user) return;
                    void handleSelectUser(user);
                }}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={isLoading ? "Loading users" : "Select user"} />
                    </SelectTrigger>
                    <SelectContent>
                        {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                                {user.name} · {user.role.toLowerCase()}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isLoading && <p className="text-[11px] text-gray-500">Loading users...</p>}
                {isError && <p className="text-[11px] text-red-600">{error?.message}</p>}
                {isPending && <p className="text-[11px] text-gray-500">Updating session...</p>}
                {statusMessage && !isPending && <p className={cn("text-[11px]", statusTone)}>{statusMessage}</p>}
            </div>
        </div>
    );
}
