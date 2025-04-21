import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Assuming db setup is in lib/db

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = parseInt(params.id, 10);

  if (isNaN(projectId)) {
    return NextResponse.json({ success: false, error: { message: 'Invalid project ID format' } }, { status: 400 });
  }

  try {
    // TODO: Replace this with your actual database query
    // Example using hypothetical db connection:
    const project = await db.project.findUnique({
      where: { id: projectId },
      // Include related data if necessary, e.g., funding progress
      // include: { fundingProgress: true } 
    });

    if (!project) {
      return NextResponse.json({ success: false, error: { message: 'Project not found' } }, { status: 404 });
    }

    // Add logic here to fetch real-time funding progress if it's not stored directly with the project
    // e.g., from blockchain or a separate table

    // Assuming project has fields like id, name, description, funding_goal, etc.
    // and potentially funding_progress fetched separately or included
    const responseData = {
      ...project,
      // Example of adding fetched funding progress
      // funding_progress: { raised: currentRaisedAmount } 
    };

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    return NextResponse.json({ success: false, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
} 