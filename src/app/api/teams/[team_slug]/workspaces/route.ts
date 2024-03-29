import { withAuth } from "@/lib/auth";
import { WorkspaceSchema } from "@/lib/schema/workspace.schema";
import mongoDb, { databaseName } from "@/lib/mongodb";
import { generateSlug } from "@/lib/utils";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const GET = withAuth(async ({ team, session }) => {
  const client = await mongoDb;
  try {
    const userId = session?.user?.id;
    const workspaces = client
      .db(databaseName)
      .collection<WorkspaceSchema>("workspaces");
    const query = {
      team: new ObjectId(team._id),
      // members: { $elemMatch: { user: new ObjectId(userId) } },
    };
    const list = await workspaces.aggregate([{ $match: query }]).toArray();
    return NextResponse.json({ workspaces: list });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Operation failed", error: err.toString() },
      { status: 500 },
    );
  }
}, {
  requiredRole: ['owner', "member"]
});

export const POST = withAuth(async ({ team, session, req }) => {
  const client = await mongoDb;
  try {
    const body = await req.json();
    if (!body || !body.name) {
      return NextResponse.json(
        { success: false, message: "Invalid request" },
        { status: 400 },
      );
    }
    const userId = session?.user?.id;
    const workspaces = client
      .db(databaseName)
      .collection<WorkspaceSchema>("workspaces");
    const slug = await generateSlug({
      title: body.name,
      didExist: async (val: string) => {
        const work = await workspaces.findOne({ "meta.slug": val });
        return !!work;
      },
    });
    const workspace = {
      name: body.name,
      team: new ObjectId(team._id),
      members: [
        {
          role: "owner",
          user: new ObjectId(userId),
        },
      ],
      description: body.description || "",
      meta: {
        slug: slug,
        title: body?.name?.substring(0, 50),
        description: body?.description?.substring(0, 150),
      },
      visibility: body?.visibility ?? "Private",
      updatedBy: new ObjectId(userId),
      createdAt: new Date().toISOString(),
      createdBy: new ObjectId(userId),
      updatedAt: new Date().toISOString(),
    } as WorkspaceSchema;

    const dbResult = await workspaces.insertOne(workspace);
    return NextResponse.json({
      success: true,
      workspace: {
        ...workspace,
        _id: dbResult.insertedId,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Operation failed", error: err.toString() },
      { status: 500 },
    );
  }
});
