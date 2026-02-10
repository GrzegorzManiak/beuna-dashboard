import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

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

async function fetchUsers(): Promise<UsersResponse> {
    const response = await apiFetch("/api/users");
    if (!response.ok) throw new Error(`Failed to load users (${response.status})`);
    const data = (await response.json()) as UsersResponse;
    return data;
}

function useUsersQuery() {
    return useQuery<UsersResponse, Error>({
        queryKey: ["users"],
        queryFn: fetchUsers,
    });
}

export {
    fetchUsers,
    useUsersQuery,
    type UserRole,
    type UserSummary,
    type UsersResponse,
};
