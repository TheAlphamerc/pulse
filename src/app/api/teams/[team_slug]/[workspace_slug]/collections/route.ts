import { withAuth } from "@/lib/auth";
import { CollectionSchema } from "@/lib/schema/collection.schema";
import { WorkspaceSchema } from "@/lib/schema/workspace.schema";
import mongoDb, { databaseName } from "@/lib/mongodb";
import { Collection } from "@/lib/types/types";
import { generateSlug } from "@/lib/utils";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

// Get list of collections
export const GET = withAuth(async ({ team, params }) => {
  const client = await mongoDb;
  try {
    const { workspace_slug, team_slug } = params ?? {};
    const collections = client
      .db(databaseName)
      .collection<Collection>("collections");

    const workspaces = client
      .db(databaseName)
      .collection<WorkspaceSchema>("workspaces");
    const workspaceDate = (await workspaces.findOne({
      "meta.slug": workspace_slug,
      team: new ObjectId(team._id),
    })) as unknown as WorkspaceSchema;

    if (!workspaceDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Operation failed",
          error: "Workspace not found",
          workspace_slug: workspace_slug,
          team_slug: team_slug,
        },
        { status: 404 },
      );
    }

    const query = {
      workspace: new ObjectId(workspaceDate?._id),
      $or: [
        {
          parent: null,
        },
        { parent: { $exists: false } },
      ],
    };
    const dbResult = await collections
      .aggregate([
        { $match: query },

        {
          $lookup: {
            from: "collections",
            localField: "_id",
            foreignField: "parent",
            as: "children",
          },
        },
        {
          $addFields: { itemCount: { $size: "$children" } },
        },
        {
          $lookup: {
            from: "teams",
            localField: "team",
            foreignField: "_id",
            as: "team",
          },
        },

        {
          $unwind: "$team",
        },
        {
          $lookup: {
            from: "workspaces",
            localField: "workspace",
            foreignField: "_id",
            as: "workspace",
          },
        },
        {
          $unwind: "$workspace",
        },
        {
          $project: {
            parent: 1,
            meta: 1,
            createdAt: 1,
            itemCount: 1,
            title: 1,
            name: 1,
            content: 1,
            contentMeta: 1,
            object: 1,
            sortIndex: 1,
            "workspace._id": 1,
            "workspace.name": 1,
            "workspace.meta": 1,
            "team._id": 1,
            "team.name": 1,
            "team.meta.slug": 1,
            children: 1,
          },
        },
        {
          $group: {
            // Group by parent and build tree-like structure with children array property
            _id: "$_id",
            team: { $first: "$team" },
            workspace: { $first: "$workspace" },
            meta: { $first: "$meta" },
            createdAt: { $first: "$createdAt" },
            itemCount: { $first: "$itemCount" },
            parent: { $first: "$parent" },
            title: { $first: "$title" },
            name: { $first: "$name" },
            content: { $first: "$content" },
            contentMeta: { $first: "$contentMeta" },
            object: { $first: "$object" },
            children: { $first: "$children" },
            sortIndex: { $first: "$sortIndex" },
          },
        },
        { $sort: { createdAt: 1 } },
      ])
      .toArray();

    return NextResponse.json({ collections: dbResult });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Operation failed", error: err.toString() },
      { status: 500 },
    );
  }
});

// Create a new collection
export const POST = withAuth(async ({ team, session, req, params }) => {
  const client = await mongoDb;
  try {
    const workspace_slug = params?.workspace_slug;
    const body = await req.json();
    const collectionToCreate = body?.collection;
    if (
      !collectionToCreate ||
      !["item", "collection", undefined].includes(collectionToCreate?.object)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to create collection",
          error: "Invalid request",
        },
        { status: 400 },
      );
    }
    const workspaceDb = client
      .db(databaseName)
      .collection<CollectionSchema>("workspaces");
    const workspace = await workspaceDb.findOne({
      "meta.slug": workspace_slug,
      team: new ObjectId(team._id),
    });

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          message: "Operation failed",
          error: "Workspace not found",
          workspace_slug: workspace_slug,
        },
        { status: 404 },
      );
    }

    const collectionsDb = client
      .db(databaseName)
      .collection<CollectionSchema>("collections");
    const slug = await generateSlug({
      title: collectionToCreate?.name ?? 'collection ',
      didExist: async (val: string) => {
        const work = await collectionsDb.findOne({
          "meta.slug": val,
          workspace: new ObjectId(workspace._id),
        });
        return !!work;
      },
      suffixLength: 6
    });
    const collection = {
      team: new ObjectId(team._id),
      meta: {
        slug: slug,
        title: collectionToCreate?.name?.splice(0, 50),
        description: collectionToCreate?.description?.splice(0, 150),
      },
      sortIndex: 0,
      children: [],
      title: collectionToCreate?.name ?? "",
      name: collectionToCreate?.name ?? "",
      content: collectionToCreate.content ?? "",
      object: collectionToCreate.object
        ? collectionToCreate.object
        : collectionToCreate.parent
          ? "item"
          : "collection",
      parent: collectionToCreate.parent
        ? new ObjectId(collectionToCreate.parent)
        : undefined,
      updatedBy: new ObjectId(session.user.id),
      workspace: new ObjectId(workspace._id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: new ObjectId(session.user.id),
    } as CollectionSchema;

    const dbResult = await collectionsDb.insertOne(collection);
    return NextResponse.json({
      success: true,
      collection: {
        ...collection,
        _id: dbResult.insertedId,
      },
      message:
        collection.object === "collection"
          ? "Collection has been created successfully"
          : "Item has been created successfully",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Operation failed", error: err.toString() },
      { status: 500 },
    );
  }
});
