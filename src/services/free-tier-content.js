import openAIClient from '../api/openai-client.js';
import contentManager from '../database/content-manager.js';
import logger from '../utils/logger.js';

class FreeTierContentService {
  constructor() {
    this.contentTemplates = [
      {
        category: 'tips',
        prompts: [
          '日常生活で役立つライフハックを1つ紹介してください。',
          'ビジネスで使える時間管理のコツを教えてください。',
          '健康的な生活習慣について1つアドバイスをください。',
        ]
      },
      {
        category: 'facts',
        prompts: [
          '興味深い科学的事実を1つ教えてください。',
          '日本の文化に関する面白い豆知識を1つ教えてください。',
          '歴史上の興味深い出来事を1つ紹介してください。',
        ]
      },
      {
        category: 'motivation',
        prompts: [
          '今日のモチベーションになる言葉を1つください。',
          '成功に関する有名な格言を1つ紹介してください。',
          'ポジティブな考え方について1つアドバイスをください。',
        ]
      }
    ];
  }

  async generateContent(count = 5) {
    try {
      logger.info('Generating content for free tier (no API search available)');
      const generatedContents = [];

      for (let i = 0; i < count; i++) {
        const template = this.getRandomTemplate();
        const prompt = this.getRandomPrompt(template);
        
        const content = await this.generateSingleContent(prompt, template.category);
        if (content) {
          generatedContents.push(content);
        }
      }

      logger.info(`Generated ${generatedContents.length} pieces of content for free tier`);
      return generatedContents;
    } catch (error) {
      logger.error('Error generating free tier content:', error);
      throw error;
    }
  }

  async generateSingleContent(prompt, category) {
    try {
      const response = await openAIClient.generateContent({
        prompt: `${prompt}\n\n要件:\n- 280文字以内で簡潔に\n- 日本語で回答\n- ハッシュタグを2-3個含める\n- エンゲージメントを促す内容にする`,
        maxTokens: 200
      });

      if (!response || !response.content) {
        logger.warn('No content generated from OpenAI');
        return null;
      }

      const contentData = {
        content_id: `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        platform: 'generated',
        content_type: 'ai_generated',
        content: response.content,
        author: 'AI Generator',
        author_id: 'ai_generator',
        metrics: {
          engagement_rate: 0,
          viral_score: 0,
        },
        tags: [category, 'ai_generated', 'free_tier'],
      };

      await contentManager.addContent(contentData);
      return contentData;
    } catch (error) {
      logger.error('Error generating single content:', error);
      return null;
    }
  }

  getRandomTemplate() {
    return this.contentTemplates[Math.floor(Math.random() * this.contentTemplates.length)];
  }

  getRandomPrompt(template) {
    return template.prompts[Math.floor(Math.random() * template.prompts.length)];
  }

  async getStoredContent(limit = 10) {
    try {
      // Get previously generated content from database
      const contents = await contentManager.getContentsByPlatform('generated', limit);
      return contents;
    } catch (error) {
      logger.error('Error getting stored content:', error);
      return [];
    }
  }

  async cleanupOldContent(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const deleted = await contentManager.deleteOldContent('generated', cutoffDate);
      logger.info(`Cleaned up ${deleted} old generated contents`);
      return deleted;
    } catch (error) {
      logger.error('Error cleaning up old content:', error);
      return 0;
    }
  }
}

export default new FreeTierContentService();