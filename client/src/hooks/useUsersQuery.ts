import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { getSessionUserId, setSessionUserId } from "@/lib/sessionStorage";

type UserRole = "ADMIN" | "MANAGER" | "ACCOUNTANT";

type UserSummary = {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: string;
    updatedAt: string;
};

type UsersResponse = {
    users: UserSummary[];
};
const PREFERRED_USER_EMAIL = "manager1@buena.local";

async function fetchUsers( ){
    const response = await apiFetch("/api/users");
    if (!response.ok) throw new Error(`Failed to load users (${response.status})`);

    const payload = (await response.json()) as UsersResponse;
    if (!getSessionUserId()) {
        const preferredUser = payload.users.find((user) => user.email === PREFERRED_USER_EMAIL);
        if (preferredUser) setSessionUserId(preferredUser.id);
    }

    return payload;
}

function useUsersQuery( ){
    return useQuery<UsersResponse, Error>({
        queryKey: ["users"],
        queryFn: fetchUsers,
    });
}

export {
    type UserRole,
    type UsersResponse,
    type UserSummary,
    useUsersQuery,
};
