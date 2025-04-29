import { NextRequest, NextResponse } from 'next/server';

// Sample mock data for pools
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
    currency: 'USD'
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
    currency: 'USD'
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
    currency: 'USD'
  }
];

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // This is just mock data for the example
    // In a real implementation, you would query your database
    const pools = mockPools;
    const totalPools = pools.length;
    
    // Format response to match what your frontend expects
    return NextResponse.json({
      success: true,
      data: {
        pools: pools,
        pagination: {
          page,
          limit,
          total: totalPools,
          pages: Math.ceil(totalPools / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error in pools API route:', error.message);
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to fetch pools: ' + (error.message || 'Unknown error'),
        code: 'POOLS_ERROR'
      }
    }, { status: 500 });
  }
}
