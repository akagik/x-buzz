import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class OpenAIClient {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.model = config.openai.model;
  }

  async analyzeContent(content, context = {}) {
    try {
      const prompt = this._buildAnalysisPrompt(content, context);
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたはソーシャルメディア戦略の専門家です。バズるコンテンツの特徴を分析し、エンゲージメントを最大化する方法を提案します。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return this._parseAnalysisResponse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error analyzing content with OpenAI:', error);
      throw error;
    }
  }

  async generatePost(topic, style = 'casual', maxLength = 280) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `あなたはX（Twitter）でバズる投稿を作成する専門家です。
            投稿スタイル: ${style}
            最大文字数: ${maxLength}文字
            絵文字やハッシュタグを適切に使用してください。`,
          },
          {
            role: 'user',
            content: `次のトピックについて、バズりやすい投稿を作成してください: ${topic}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Error generating post with OpenAI:', error);
      throw error;
    }
  }

  async decideAction(currentState, availableActions) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `あなたはAI-buzzエージェントの意思決定システムです。
            現在の状態とコンテキストに基づいて、最適なアクションを選択してください。
            選択は戦略的で、エンゲージメントを最大化することを目指してください。`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              currentState,
              availableActions,
              instruction: '最適なアクションを選択し、その理由を説明してください。',
            }),
          },
        ],
        temperature: 0.6,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error deciding action with OpenAI:', error);
      throw error;
    }
  }

  async analyzeUser(userProfile) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたはソーシャルメディアユーザー分析の専門家です。フォローすべきユーザーを特定します。',
          },
          {
            role: 'user',
            content: `次のユーザープロフィールを分析し、フォローすべきかどうか判断してください: ${JSON.stringify(userProfile)}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error analyzing user with OpenAI:', error);
      throw error;
    }
  }

  async optimizeSchedule(currentSchedule, performanceData) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '過去のパフォーマンスデータに基づいて、最適な投稿スケジュールを提案してください。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              currentSchedule,
              performanceData,
              instruction: '最適な投稿時間と頻度を提案してください。',
            }),
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error optimizing schedule with OpenAI:', error);
      throw error;
    }
  }

  _buildAnalysisPrompt(content, context) {
    return `
    以下のコンテンツを分析してください:
    
    コンテンツ: ${content}
    
    コンテキスト:
    - プラットフォーム: ${context.platform || 'X (Twitter)'}
    - カテゴリー: ${context.category || '不明'}
    - エンゲージメント数: ${context.engagement || '不明'}
    
    以下の観点から分析してください:
    1. なぜこのコンテンツがバズったのか
    2. 主要な要素（トレンド、感情、タイミングなど）
    3. 再現可能な要素
    4. 改善点
    `;
  }

  _parseAnalysisResponse(response) {
    try {
      return JSON.parse(response);
    } catch {
      return {
        analysis: response,
        buzzFactors: [],
        reproducibleElements: [],
        improvements: [],
      };
    }
  }
}

export default new OpenAIClient();