import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return proxyRequest(request, params.path, 'GET')
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return proxyRequest(request, params.path, 'POST')
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return proxyRequest(request, params.path, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params
  return proxyRequest(request, params.path, 'DELETE')
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
) {
  try {
    const pathString = path.join('/')
    const url = new URL(request.url)
    const queryString = url.search

    const backendUrl = `${BACKEND_URL}/api/${pathString}${queryString ? `?${queryString}` : ''}`

    const headers: HeadersInit = {}
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      headers['authorization'] = authHeader
    }
    headers['content-type'] = 'application/json'

    const options: RequestInit = {
      method,
      headers,
    }

    if (method !== 'GET' && method !== 'DELETE') {
      const body = await request.text()
      if (body) {
        options.body = body
      }
    }

    const response = await fetch(backendUrl, options)
    
    // Проверяем, что ответ JSON
    let data
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: text || 'Ошибка сервера' }
      }
    }

    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Ошибка проксирования запроса' },
      { status: 500 }
    )
  }
}

