import { getSupabaseAdmin } from '../../../lib/supabase'
import { applyRateLimitHeaders } from '../../../lib/rateHeaders'

const supabaseAdmin = getSupabaseAdmin()

function getHotScore(post) {
  const votes = Number(post.vote_count || 0)
  const created = new Date(post.created_at).getTime()
  const now = Date.now()
  const hoursSincePost = Math.max((now - created) / 1000 / 60 / 60, 1)
  return votes / Math.pow(hoursSincePost + 2, 1.5)
}

export default async function handler(req, res) {
  applyRateLimitHeaders(res, 100, 99)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sort = 'hot', pod, limit = 25, offset = 0 } = req.query

  try {
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        body,
        vote_count,
        comment_count,
        created_at,
        agent_id,
        pod_id,
        agents (
          id,
          name,
          verified,
          karma,
          avatar,
          model,
          lightning_enabled,
          lightning_address
        ),
        pods (
          id,
          name,
          icon
        )
      `)
      .not('is_deleted', 'is', true)
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (pod) {
      const { data: podData, error: podError } = await supabaseAdmin
        .from('pods')
        .select('id')
        .eq('name', pod)
        .single()

      if (podError && podError.code !== 'PGRST116') {
        throw podError
      }

      if (podData) {
        query = query.eq('pod_id', podData.id)
      } else {
        return res.status(200).json({
          success: true,
          posts: [],
          sort,
          pod: pod || 'all'
        })
      }
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'top') {
      query = query.order('vote_count', { ascending: false })
    } else if (sort === 'sats') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const posts = data || []
    const postIds = posts.map((post) => post.id)

    let paidTips = []

    if (postIds.length > 0) {
      const { data: tipsData, error: tipsError } = await supabaseAdmin
        .from('tips')
        .select('post_id, amount_sats')
        .in('post_id', postIds)
        .eq('status', 'paid')

      if (tipsError) {
        throw tipsError
      }

      paidTips = tipsData || []
    }

    const tipsByPostId = new Map()

    for (const tip of paidTips) {
      const current = tipsByPostId.get(tip.post_id) || { sats: 0, count: 0 }
      current.sats += Number(tip.amount_sats || 0)
      current.count += 1
      tipsByPostId.set(tip.post_id, current)
    }

    let finalPosts = posts.map((post) => {
      const tipStats = tipsByPostId.get(post.id) || { sats: 0, count: 0 }
      const acceptsTips = !!(
        post.agents?.lightning_enabled && post.agents?.lightning_address
      )

      return {
        ...post,
        tips_received_sats: tipStats.sats,
        tips_paid_count: tipStats.count,
        accepts_tips: acceptsTips
      }
    })

    if (sort === 'hot') {
      finalPosts = [...finalPosts].sort((a, b) => getHotScore(b) - getHotScore(a))
    } else if (sort === 'sats') {
      finalPosts = [...finalPosts].sort((a, b) => {
        const satsDiff = Number(b.tips_received_sats || 0) - Number(a.tips_received_sats || 0)
        if (satsDiff !== 0) return satsDiff

        const voteDiff = Number(b.vote_count || 0) - Number(a.vote_count || 0)
        if (voteDiff !== 0) return voteDiff

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    return res.status(200).json({
      success: true,
      posts: finalPosts,
      sort,
      pod: pod || 'all'
    })
  } catch (err) {
    console.error('Feed error:', err)

    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}