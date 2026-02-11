import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUsersQuery } from "@/hooks/useUsersQuery";
import { getSessionUserId } from "@/lib/sessionStorage";
import { ArrowLeft } from "lucide-react";

function NewPropertyHeader() {
    const navigate = useNavigate();
    const { data } = useUsersQuery();
    const users = useMemo(() => data?.users ?? [], [data]);
    const currentUserId = getSessionUserId();
    const currentUser = useMemo(
        () => users.find((u) => u.id === currentUserId) ?? null,
        [users, currentUserId],
    );

    return (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3">
            <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-700"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Portfolio
            </button>

            {currentUser && (
                <span className="text-xs text-gray-400">
                    {currentUser.name}
                </span>
            )}
        </div>
    );
}

export { NewPropertyHeader };
