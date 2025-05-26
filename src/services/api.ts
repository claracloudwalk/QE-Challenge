import { userDb } from './userDb';

const API_BASE_URL = 'https://qe-api.services.staging.cloudwalk.network';

interface TransferRequest {
  to_user_id: number;
  amount: number;
  payment_method: 'debit' | 'credit';
}

interface PixTransferRequest {
  from_user_id?: number;
  to_user_id: number;
  amount: number;
}

interface SetBalanceRequest {
  user_id: number;
  balance: number;
}

interface UserResponse {
  id: number;
  handle: string;
  balance: number;
  message?: string;
  error?: string;
}

export const api = {
  async getBalance(userId: number) {
    console.log('API: Buscando saldo para userId:', userId);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('API: Erro ao buscar saldo:', response.status, response.statusText);
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      console.log('API: Saldo obtido:', data);
      return data.balance;
    } catch (error) {
      console.error('API: Erro na chamada getBalance:', error);
      throw error;
    }
  },

  async setBalance(data: SetBalanceRequest) {
    console.log('API: Atualizando saldo:', data);
    try {
      const response = await fetch(`${API_BASE_URL}/users/set-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        console.error('API: Erro ao atualizar saldo:', response.status, response.statusText);
        throw new Error('Failed to set balance');
      }
      const result = await response.json();
      console.log('API: Saldo atualizado com sucesso:', result);
      return result;
    } catch (error) {
      console.error('API: Erro na chamada setBalance:', error);
      throw error;
    }
  },

  async updateBalancesAfterTransaction(senderId: number, receiverId: number, amount: number) {
    console.log('API: Iniciando atualização de saldos:', { senderId, receiverId, amount });
    try {
      // Get current balances
      const senderBalance = await this.getBalance(senderId);
      const receiverBalance = await this.getBalance(receiverId);
      console.log('API: Saldos atuais:', { senderBalance, receiverBalance });

      // Update sender's balance (subtract amount)
      const newSenderBalance = senderBalance - amount;
      await this.setBalance({
        user_id: senderId,
        balance: newSenderBalance
      });

      // Update receiver's balance (add amount)
      await this.setBalance({
        user_id: receiverId,
        balance: receiverBalance + amount
      });

      // Return updated balances
      const updatedSenderBalance = await this.getBalance(senderId);
      const updatedReceiverBalance = await this.getBalance(receiverId);
      console.log('API: Saldos atualizados:', { updatedSenderBalance, updatedReceiverBalance });

      return {
        senderBalance: updatedSenderBalance,
        receiverBalance: updatedReceiverBalance
      };
    } catch (error) {
      console.error('API: Erro ao atualizar saldos:', error);
      throw error;
    }
  },

  async transferMoney(data: TransferRequest) {
    const response = await fetch(`${API_BASE_URL}/pay/pos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Transfer failed');
    }

    return response.json();
  },

  async transferPix(data: PixTransferRequest) {
    // Se from_user_id não foi fornecido, tenta pegar do localStorage
    if (!data.from_user_id && typeof window !== 'undefined') {
      const storedId = localStorage.getItem('userId');
      if (storedId) {
        data.from_user_id = Number(storedId);
      }
    }

    if (!data.from_user_id) {
      throw new Error('from_user_id is required for PIX transfers');
    }

    console.log('Iniciando transferência PIX com dados:', {
        from_user_id: data.from_user_id,
        to_user_id: data.to_user_id,
        amount: data.amount
    });

    const requestBody = {
        from_user_id: Number(data.from_user_id),
        to_user_id: Number(data.to_user_id),
        amount: Number(data.amount)
    };

    console.log('Payload enviado para /pay/pix:', requestBody);
    console.log('URL da requisição:', `${API_BASE_URL}/pay/pix`);

    try {
        const response = await fetch(`${API_BASE_URL}/pay/pix`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': window.location.origin
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro na transferência PIX:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`PIX transfer failed: ${errorText}`);
        }

        return response.json();
    } catch (error) {
        console.error('Erro detalhado na transferência PIX:', error);
        throw error;
    }
  },

  async payLink(data: any) {
    const response = await fetch(`${API_BASE_URL}/pay/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Link payment failed');
    }

    return response.json();
  },

  async cardPayment(data: any) {
    const response = await fetch(`${API_BASE_URL}/card_payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Card payment failed');
    }

    return response.json();
  },

  async createReceivable(data: any) {
    const response = await fetch(`${API_BASE_URL}/receivables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create receivable');
    }

    return response.json();
  },

  async getUserInfo(identifier: string): Promise<UserResponse> {
    console.log('API: Buscando usuário com identificador:', identifier);
    try {
      // Se for número, busca direto pelo ID
      if (/^\d+$/.test(identifier)) {
        console.log('API: Buscando por ID:', identifier);
        const res = await fetch(`${API_BASE_URL}/users/${identifier}`);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('API: Erro ao buscar usuário por ID:', {
            status: res.status,
            statusText: res.statusText,
            error: errorText
          });
          throw new Error(errorText || 'Usuário não encontrado');
        }
        const data = await res.json();
        console.log('API: Usuário encontrado por ID:', data);
        return data;
      }

      // Busca por handle, email, cpf, etc
      console.log('API: Buscando por handle/email/cpf:', identifier);
      const res = await fetch(`${API_BASE_URL}/users/search?query=${encodeURIComponent(identifier)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API: Erro ao buscar usuário por query:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText
        });
        throw new Error(errorText || 'Usuário não encontrado');
      }

      const data = await res.json();
      console.log('API: Resultado da busca:', data);

      if (Array.isArray(data) && data.length > 0) {
        console.log('API: Usuário encontrado na lista:', data[0]);
        return data[0];
      }
      if (data && data.id) {
        console.log('API: Usuário encontrado direto:', data);
        return data;
      }

      console.error('API: Nenhum usuário encontrado para:', identifier);
      throw new Error('Usuário não encontrado');
    } catch (error) {
      console.error('API: Erro na busca de usuário:', error);
      throw error;
    }
  },

  async createUser(data: { handle: string }): Promise<UserResponse> {
    console.log('API: Criando novo usuário com handle:', data.handle);
    try {
      const response = await fetch(`${API_BASE_URL}/users/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API: Erro ao criar usuário:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(errorText || 'Failed to create user');
      }

      const result = await response.json();
      console.log('API: Usuário criado com sucesso:', result);
      console.log('Resposta bruta da API:', response);
      console.log('Body da resposta:', result);
      return result;
    } catch (error) {
      console.error('API: Erro na chamada createUser:', error);
      throw error;
    }
  }
};

async function resolveUserId(identifier: string): Promise<number> {
  try {
    const user = await api.getUserInfo(identifier);
    if (user && typeof user.id === 'number' && user.id > 0) {
      return user.id;
    }
    throw new Error('ID de usuário inválido');
  } catch (err) {
    console.error('Erro ao resolver ID do usuário:', err);
    throw new Error('Não foi possível encontrar o usuário de destino.');
  }
} 