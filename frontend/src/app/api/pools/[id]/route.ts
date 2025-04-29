import { NextRequest, NextResponse } from 'next/server';

// Sample mock data for pools (same as in the main pools route)
const mockPools = [
  {
    id: '1',
    name: 'Skin Cancer Research',
    description: 'Supporting innovative research in skin cancer prevention, detection, and treatment.',
    theme: 'research',
    sponsor_id: 1,
    admin_id: 1,
    company_id: 1,
    contract_pool_id: 1,
    round_duration: 30,
    total_funds: 50000,
    allocated_funds: 10000,
    is_active: true,
    logo_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3',
    banner_image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?ixlib=rb-4.0.3',
    matching_ratio: 1.5,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    is_distributed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_count: 5,
    currency: 'USD',
    projects: [
      {
        id: '101',
        name: 'Early Detection of Melanoma',
        description: 'Using AI to improve early detection of melanoma.',
        charity_id: 1,
        pool_id: 1,
        funding_goal: 20000,
        image_url: 'https://images.unsplash.com/photo-1581093196277-9f0c7fd1fbe2?ixlib=rb-4.0.3',
        is_active: true,
        contributions_count: 15,
        charity_name: 'Skin Health Foundation',
        funding_progress: { raised: 12500 }
      },
      {
        id: '102',
        name: 'UV Protection Innovation',
        description: 'Developing advanced UV protection technologies.',
        charity_id: 2,
        pool_id: 1,
        funding_goal: 15000,
        image_url: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?ixlib=rb-4.0.3',
        is_active: true,
        contributions_count: 12,
        charity_name: 'Cancer Research Alliance',
        funding_progress: { raised: 8000 }
      }
    ]
  },
  {
    id: '2',
    name: 'Eczema Treatment Innovation',
    description: 'Funding new approaches to treating eczema and other chronic skin conditions.',
    theme: 'innovation',
    sponsor_id: 2,
    admin_id: 1,
    company_id: 2,
    contract_pool_id: 2,
    round_duration: 45,
    total_funds: 75000,
    allocated_funds: 20000,
    is_active: true,
    logo_image: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?ixlib=rb-4.0.3',
    banner_image: 'https://images.unsplash.com/photo-1581093196277-9f0c7fd1fbe2?ixlib=rb-4.0.3',
    matching_ratio: 2.0,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    is_distributed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_count: 3,
    currency: 'USD',
    projects: [
      {
        id: '201',
        name: 'Novel Eczema Treatments',
        description: 'Researching plant-based treatments for eczema.',
        charity_id: 3,
        pool_id: 2,
        funding_goal: 25000,
        image_url: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?ixlib=rb-4.0.3',
        is_active: true,
        contributions_count: 18,
        charity_name: 'Dermatology Research Institute',
        funding_progress: { raised: 15000 }
      }
    ]
  },
  {
    id: '3',
    name: 'Dermatology Education',
    description: 'Supporting educational initiatives in dermatology for underserved communities.',
    theme: 'education',
    sponsor_id: 3,
    admin_id: 1,
    company_id: 3,
    contract_pool_id: 3,
    round_duration: 60,
    total_funds: 100000,
    allocated_funds: 30000,
    is_active: true,
    logo_image: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?ixlib=rb-4.0.3',
    banner_image: 'https://images.unsplash.com/photo-1544717305-996b815c338c?ixlib=rb-4.0.3',
    matching_ratio: 1.0,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    is_distributed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_count: 7,
    currency: 'USD',
    projects: [
      {
        id: '301',
        name: 'Community Dermatology Training',
        description: 'Training healthcare workers in underserved areas on basic dermatology.',
        charity_id: 4,
        pool_id: 3,
        funding_goal: 30000,
        image_url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?ixlib=rb-4.0.3',
        is_active: true,
        contributions_count: 25,
        charity_name: 'Global Health Initiative',
        funding_progress: { raised: 18000 }
      },
      {
        id: '302',
        name: 'Public Awareness Campaign',
        description: 'Educational campaign on skin health and protection.',
        charity_id: 5,
        pool_id: 3,
        funding_goal: 18000,
        image_url: 'https://images.unsplash.com/photo-1544717305-996b815c338c?ixlib=rb-4.0.3',
        is_active: true,
        contributions_count: 20,
        charity_name: 'Public Health Association',
        funding_progress: { raised: 12000 }
      }
    ]
  }
];

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const poolId = params.id;
    
    // Find the pool with the matching ID
    const pool = mockPools.find(p => p.id === poolId);
    
    if (!pool) {
      return NextResponse.json({
        success: false,
        error: {
          message: `Pool with ID ${poolId} not found`,
          code: 'POOL_NOT_FOUND'
        }
      }, { status: 404 });
    }
    
    // Return the pool data
    return NextResponse.json({
      success: true,
      data: pool
    });
  } catch (error: any) {
    console.error(`Error fetching pool ${params.id}:`, error.message);
    
    return NextResponse.json({
      success: false,
      error: {
        message: `Failed to fetch pool: ${error.message || 'Unknown error'}`,
        code: 'POOL_ERROR'
      }
    }, { status: 500 });
  }
}
