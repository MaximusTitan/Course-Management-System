import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Announcement, Batch, Prisma } from "@prisma/client";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

type AnnouncementList = Announcement & { batch: Batch | null };

const AnnouncementListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  try {
    const { userId, sessionClaims } = auth();
    const role =
      (sessionClaims?.metadata as { role?: string })?.role || "student";

    // Early return if no user ID for roles that require it
    if (!userId && ["teacher", "student"].includes(role)) {
      return (
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <div className="text-red-500">
            Unable to load announcements. Please log in.
          </div>
        </div>
      );
    }

    const columns = [
      { header: "Title", accessor: "title" },
      { header: "Description", accessor: "description" },
      { header: "Batch", accessor: "batch" },
      {
        header: "Date",
        accessor: "date",
        className: "hidden md:table-cell",
      },
      ...(role === "admin" ? [{ header: "Actions", accessor: "action" }] : []),
    ];

    const renderRow = (item: AnnouncementList) => (
      <tr
        key={item.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="flex items-center gap-4 p-4">{item.title}</td>
        <td className="flex items-center gap-4 p-4">{item.description}</td>
        <td>{item.batch?.name || "-"}</td>
        <td className="hidden md:table-cell">
          {new Intl.DateTimeFormat("en-US").format(item.date)}
        </td>
        {role === "admin" && (
          <td>
            <div className="flex items-center gap-2">
              <FormContainer table="announcement" type="update" data={item} />
              <FormContainer table="announcement" type="delete" id={item.id} />
            </div>
          </td>
        )}
      </tr>
    );

    const { page, ...queryParams } = searchParams;
    const p = page ? parseInt(page) : 1;

    const query: Prisma.AnnouncementWhereInput = {};

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          switch (key) {
            case "search":
              query.title = { contains: value, mode: "insensitive" };
              break;
          }
        }
      }
    }

    // Type-safe role conditions
    const roleConditions: Record<string, Prisma.BatchWhereInput> = {
      teacher: {
        lessons: {
          some: {
            teacherId: userId!,
          },
        },
      },
      student: {
        students: {
          some: {
            id: userId!,
          },
        },
      },
    };

    // Construct query based on role
    if (role !== "admin") {
      query.OR = [
        { batchId: null },
        ...(roleConditions[role] ? [{ batch: roleConditions[role] }] : []),
      ];
    }

    const [data, count] = await prisma.$transaction([
      prisma.announcement.findMany({
        where: query,
        include: {
          batch: true,
        },
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
        orderBy: {
          date: "desc",
        },
      }),
      prisma.announcement.count({ where: query }),
    ]);

    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="flex items-center justify-between">
          <h1 className="hidden md:block text-lg font-semibold">
            All Announcements
          </h1>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <Suspense fallback={<div>Loading search...</div>}>
              <TableSearch />
            </Suspense>
            <div className="flex items-center gap-4 self-end">
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
                <Image src="/filter.png" alt="Filter" width={14} height={14} />
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
                <Image src="/sort.png" alt="Sort" width={14} height={14} />
              </button>
              {role === "admin" && (
                <FormContainer table="announcement" type="create" />
              )}
            </div>
          </div>
        </div>
        {data.length > 0 ? (
          <>
            <Table columns={columns} renderRow={renderRow} data={data} />
            <Pagination page={p} count={count} />
          </>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No announcements found
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("Error in AnnouncementListPage:", error);
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <div className="text-red-500">
          An error occurred while loading announcements. Please try again later.
        </div>
      </div>
    );
  }
};

export default AnnouncementListPage;
