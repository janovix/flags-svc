import type { Prisma } from "../../generated/prisma/client";
import type { PrismaClient } from "../../lib/prisma";
import type { CreateFlagInput, FlagDefinition, UpdateFlagInput } from "./types";
import { rowToFlagDefinition, serializeFlagValue } from "./serialization";

export type ListFlagsQuery = {
	search?: string;
	type?: string;
	tag?: string;
	limit?: number;
	offset?: number;
};

export class FlagRepository {
	constructor(private prisma: PrismaClient) {}

	async listAll(): Promise<FlagDefinition[]> {
		const rows = await this.prisma.flagDefinition.findMany({
			orderBy: { key: "asc" },
		});
		return rows.map((r) => rowToFlagDefinition(r));
	}

	async listFiltered(
		q: ListFlagsQuery,
	): Promise<{ items: FlagDefinition[]; total: number }> {
		const limit = Math.min(q.limit ?? 100, 500);
		const offset = q.offset ?? 0;

		const where: Prisma.FlagDefinitionWhereInput = {};

		if (q.search) {
			const s = q.search.trim();
			where.OR = [
				{ key: { contains: s } },
				{ name: { contains: s } },
				{ description: { contains: s } },
			];
		}

		if (q.type) {
			where.type = q.type;
		}

		if (q.tag) {
			where.tags = { contains: `"${q.tag}"` };
		}

		const [rows, total] = await Promise.all([
			this.prisma.flagDefinition.findMany({
				where,
				orderBy: { key: "asc" },
				take: limit,
				skip: offset,
			}),
			this.prisma.flagDefinition.count({ where }),
		]);

		return { items: rows.map((r) => rowToFlagDefinition(r)), total };
	}

	async findByKey(key: string): Promise<FlagDefinition | null> {
		const row = await this.prisma.flagDefinition.findUnique({ where: { key } });
		return row ? rowToFlagDefinition(row) : null;
	}

	async create(input: CreateFlagInput): Promise<FlagDefinition> {
		const row = await this.prisma.flagDefinition.create({
			data: {
				key: input.key,
				name: input.name,
				description: input.description ?? null,
				type: input.type,
				defaultValue: serializeFlagValue(input.defaultValue),
				enabled: input.enabled ?? true,
				environments: input.environments?.length
					? JSON.stringify(input.environments)
					: null,
				targeting: input.targeting?.length
					? JSON.stringify(input.targeting)
					: null,
				tags: input.tags?.length ? JSON.stringify(input.tags) : null,
			},
		});
		return rowToFlagDefinition(row);
	}

	async update(
		key: string,
		input: UpdateFlagInput,
	): Promise<FlagDefinition | null> {
		const existing = await this.prisma.flagDefinition.findUnique({
			where: { key },
		});
		if (!existing) return null;

		const data: Record<string, unknown> = {};
		if (input.name !== undefined) data.name = input.name;
		if (input.description !== undefined) data.description = input.description;
		if (input.type !== undefined) data.type = input.type;
		if (input.defaultValue !== undefined)
			data.defaultValue = serializeFlagValue(input.defaultValue);
		if (input.enabled !== undefined) data.enabled = input.enabled;
		if (input.environments !== undefined) {
			data.environments = input.environments?.length
				? JSON.stringify(input.environments)
				: null;
		}
		if (input.targeting !== undefined) {
			data.targeting = input.targeting?.length
				? JSON.stringify(input.targeting)
				: null;
		}
		if (input.tags !== undefined) {
			data.tags = input.tags?.length ? JSON.stringify(input.tags) : null;
		}

		const row = await this.prisma.flagDefinition.update({
			where: { key },
			data: data as Parameters<
				typeof this.prisma.flagDefinition.update
			>[0]["data"],
		});
		return rowToFlagDefinition(row);
	}

	async delete(key: string): Promise<boolean> {
		try {
			await this.prisma.flagDefinition.delete({ where: { key } });
			return true;
		} catch {
			return false;
		}
	}

	async toggleEnabled(key: string): Promise<FlagDefinition | null> {
		const existing = await this.prisma.flagDefinition.findUnique({
			where: { key },
		});
		if (!existing) return null;
		const row = await this.prisma.flagDefinition.update({
			where: { key },
			data: { enabled: !existing.enabled },
		});
		return rowToFlagDefinition(row);
	}
}
