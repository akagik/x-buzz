import db from '../database/db.js';
import openaiClient from '../api/openai-client.js';
import logger from '../utils/logger.js';

class PerformanceAnalyzer {
  async analyzeRecentPerformance() {
    try {
      logger.info('Starting performance analysis...');
      
      const performanceData = await this.gatherPerformanceData();
      const insights = await this.generateInsights(performanceData);
      
      // Store performance data for future reference
      db.updateSetting('last_performance_analysis', JSON.stringify({
        timestamp: new Date().toISOString(),
        data: performanceData,
        insights,
      }));
      
      // Apply optimizations if needed
      await this.applyOptimizations(insights);
      
      logger.info('Performance analysis completed');
      return { performanceData, insights };
    } catch (error) {
      logger.error('Error in performance analysis:', error);
      throw error;
    }
  }

  async gatherPerformanceData() {
    const last7Days = db.db.prepare(`
      SELECT 
        DATE(posted_at) as date,
        COUNT(*) as post_count,
        AVG(json_extract(metrics, '$.like_count')) as avg_likes,
        AVG(json_extract(metrics, '$.retweet_count')) as avg_retweets,
        SUM(json_extract(metrics, '$.like_count')) as total_likes
      FROM posts 
      WHERE status = 'posted' 
        AND posted_at >= datetime('now', '-7 days')
        AND metrics IS NOT NULL
      GROUP BY date
      ORDER BY date DESC
    `).all();
    
    const topPerformingContent = db.db.prepare(`
      SELECT 
        c.content_id,
        c.content,
        c.metrics,
        c.tags
      FROM contents c
      WHERE c.analyzed = 1
        AND json_extract(c.metrics, '$.viral_score') > 100
      ORDER BY json_extract(c.metrics, '$.viral_score') DESC
      LIMIT 20
    `).all().map(db._parseJsonFields);
    
    const engagementPatterns = db.db.prepare(`
      SELECT 
        strftime('%H', performed_at) as hour,
        interaction_type,
        COUNT(*) as count
      FROM interactions
      WHERE performed_at >= datetime('now', '-7 days')
      GROUP BY hour, interaction_type
      ORDER BY hour
    `).all();
    
    return {
      dailyPerformance: last7Days,
      topContent: topPerformingContent,
      engagementPatterns,
      totalEngagement: this.calculateTotalEngagement(last7Days),
    };
  }

  calculateTotalEngagement(dailyData) {
    return dailyData.reduce((total, day) => {
      return total + (day.total_likes || 0) + ((day.avg_retweets || 0) * day.post_count);
    }, 0);
  }

  async generateInsights(performanceData) {
    const insights = await openaiClient.decideAction(
      {
        performanceData,
        request: 'Generate insights and recommendations based on this performance data',
      },
      ['analyze_trends', 'identify_improvements', 'suggest_optimizations'],
    );
    
    return {
      trends: this.identifyTrends(performanceData),
      recommendations: insights.recommendations || [],
      optimizations: insights.optimizations || [],
    };
  }

  identifyTrends(data) {
    const trends = [];
    
    // Check daily performance trend
    if (data.dailyPerformance.length > 1) {
      const recent = data.dailyPerformance[0];
      const previous = data.dailyPerformance[1];
      
      if (recent.avg_likes > previous.avg_likes * 1.2) {
        trends.push('Increasing engagement trend');
      } else if (recent.avg_likes < previous.avg_likes * 0.8) {
        trends.push('Decreasing engagement trend');
      }
    }
    
    // Check best performing hours
    const hourlyEngagement = {};
    data.engagementPatterns.forEach((pattern) => {
      if (!hourlyEngagement[pattern.hour]) {
        hourlyEngagement[pattern.hour] = 0;
      }
      hourlyEngagement[pattern.hour] += pattern.count;
    });
    
    const bestHours = Object.entries(hourlyEngagement)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => hour);
    
    trends.push(`Best engagement hours: ${bestHours.join(', ')}`);
    
    return trends;
  }

  async applyOptimizations(insights) {
    // This would apply automatic optimizations based on insights
    // For now, just log the recommendations
    if (insights.recommendations && insights.recommendations.length > 0) {
      logger.info('Performance recommendations:', insights.recommendations);
    }
  }
}

export default new PerformanceAnalyzer();