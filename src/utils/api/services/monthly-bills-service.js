import apiService from '../api-service.js';

export class MonthlyBillsService {
  async getMonthlyBills(filters = {}) {
    return apiService.monthlyBills.getMonthlyBills(filters);
  }

  async getBill(billId) {
    return apiService.monthlyBills.getBill(billId);
  }

  async getBillBreakdown(billId) {
    return apiService.monthlyBills.getBillBreakdown(billId);
  }

  async createMonthlyBill(payload) {
    return apiService.monthlyBills.createMonthlyBill(payload);
  }

  async updateBill(billId, payload) {
    return apiService.monthlyBills.updateBill(billId, payload);
  }

  async deleteBill(billId) {
    return apiService.monthlyBills.deleteBill(billId);
  }

  async markAsPaid(billId, paymentData = {}) {
    return apiService.monthlyBills.markAsPaid(billId, paymentData);
  }

  async createBillItem(billId, payload) {
    return apiService.monthlyBills.createBillItem(billId, payload);
  }

  async updateBillItem(billId, itemId, payload) {
    return apiService.monthlyBills.updateBillItem(billId, itemId, payload);
  }

  async deleteBillItem(billId, itemId) {
    return apiService.monthlyBills.deleteBillItem(billId, itemId);
  }

  async getProviders(filters = {}) {
    return apiService.monthlyBills.getProviders(filters);
  }

  async createProvider(payload) {
    return apiService.monthlyBills.createProvider(payload);
  }

  async updateProvider(providerId, payload) {
    return apiService.monthlyBills.updateProvider(providerId, payload);
  }

  async deleteProvider(providerId) {
    return apiService.monthlyBills.deleteProvider(providerId);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatPeriodDisplay(month, year) {
    if (!month || !year) return '-';
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
    });
  }

  getCurrentYear() {
    return new Date().getFullYear();
  }

  getCurrentMonth() {
    return new Date().getMonth() + 1;
  }
}
