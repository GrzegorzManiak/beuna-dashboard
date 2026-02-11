import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";

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

async function fetchUsers( ){
    const response = await apiFetch("/api/users");
    if (!response.ok) throw new Error(`Failed to load users (${response.status})`);
    return (await response.json()) as UsersResponse;
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
