(function(window, document, undefined) {

  /** Represents a single check. */
  var Check = function(amount) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw "Amount of check must be integer and can not < 0";
    }
    this.amount = amount;
    this.discretionaryIncome = this.amount;
    this.deductedAmount = 0;
  };
  Check.prototype.deduct = function(deductedAmount) {
    // DeductedAmount can be positive or negative. If negative, it means that we have previous
    // savings in the bank that we can distribute to this paycheck to increase discretionary income.
    this.deductedAmount += deductedAmount;
    this.discretionaryIncome = this.amount - this.deductedAmount;
  };
  Check.prototype.toString = function() {
    return "[Amount:" + this.amount +
        ", Discretionary:" + this.discretionaryIncome + "]";
  };

  /** Represents a bill. */
  var Bill = function(amount, dueDate) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw "Amount of bill must be integer and can not < 0";
    }
    this.amount = amount;
    this.dueDate = dueDate;
  };
  Bill.prototype.toString = function() {
    return "[Amount:" + this.amount + ", Due Date:" + this.dueDate + "]";
  };

  /**
   * Represents a particular financial cycle, given an integer array of |checksAndBills|. In the
   * |checksAndBills| array, checks are represented as positive integers, while bills are
   * represented as negative integers or 0.
   */
  var FinanceCycle = function(checksAndBills) {
    this.process(checksAndBills);
  };
  FinanceCycle.prototype.process = function(checksAndBills) {
    // Process the checks and bills to a more structured format. We group consecutive bills to a
    // single bill with the due date being the index of the previous check, and create Check
    // objects for checks.
    this.processedChecks = [];
    this.processedBills = [];
    // We store this for verification purposes.
    this.originalChecksAndBills = [];
    var checksAndBillsCount = checksAndBills.length;
    for (var i = 0; i < checksAndBillsCount; i++) {
      if (checksAndBills[i] > 0) {
        var check = new Check(checksAndBills[i]);
        this.processedChecks.push(check);
        this.originalChecksAndBills.push(check);
      } else {
        var bill = 0;
        var dueDate = this.processedChecks.length - 1;
        if (dueDate < 0) {
          // This means that the first element that comes in for the financial cycle is a bill,
          // which violates our assumption.
          throw "A check must exist before a bill";
        }
        while (true) {
          var amount = checksAndBills[i];
          this.originalChecksAndBills.push(new Bill(-amount, dueDate));
          bill += amount;
          if (i + 1 == checksAndBillsCount || checksAndBills[i + 1] > 0) {
            this.processedBills.push(new Bill(-bill, dueDate));
            break;
          }
          i++;
        }
      }
    }
  };
  FinanceCycle.prototype.deductPaychecks = function() {
    // First, we try to pay out each bill with the check immediately before them.
    var billLength = this.processedBills.length;
    for (var i = 0; i < billLength; i++) {
      var bill = this.processedBills[i];
      var check = this.processedChecks[bill.dueDate];
      check.deduct(bill.amount);
    }
    // Now, we should try to even out the deduction so that we can get decent discretionary income
    // per pay check.

    // For a certain paycheck, the money you can move from previous paychecks to even up the
    // shortage of current paycheck is represented as distributableIncome.
    var distributableIncome = this.processedChecks.reduce(function(sum, obj) {
      return sum + obj.discretionaryIncome;
    }, 0);
    // PendingDeduction is the money that we need to deduct from current or previous paychecks
    // in order to distribute to future paychecks that is short of money.
    var pendingDeduction = 0;
    for (var i = this.processedChecks.length - 1; i >= 0; i--) {
      var expectedAverageDiscretionaryIncome = Math.round(distributableIncome / (i + 1));
      var currentCheck = this.processedChecks[i];
      var currentDiscretionaryIncome = currentCheck.discretionaryIncome;
      var matchingDiff = 0;
      if (currentDiscretionaryIncome < expectedAverageDiscretionaryIncome) {
        // If the discretionary income of current paycheck is lower than the expected average,
        // we should match it up to the average from the money in distributableIncome.
        matchingDiff = expectedAverageDiscretionaryIncome - currentDiscretionaryIncome;
      } else if (pendingDeduction > 0) {
        // If the discretionary income of current paycheck is greater than the expected average,
        // we should try to pay off the pending deduction at best effort.
        var targetDiscretionaryIncome = Math.max(
            expectedAverageDiscretionaryIncome, currentDiscretionaryIncome - pendingDeduction);
        matchingDiff = targetDiscretionaryIncome - currentDiscretionaryIncome;
      }
      currentCheck.deduct(-matchingDiff);
      pendingDeduction += (matchingDiff);
      distributableIncome -= currentCheck.discretionaryIncome;
    }
  };
  FinanceCycle.prototype.verify = function() {
    var savings = 0;
    for (var i = 0; i < this.originalChecksAndBills.length; i++) {
      var item = this.originalChecksAndBills[i];
      if (item instanceof Check) {
        if (item.discretionaryIncome < 0) {
          return false;
        }
        savings += item.deductedAmount;
      } else {
        savings -= item.amount;
      }
      if (savings < 0) {
        return false;
      }
    }
    return true;
  };
  FinanceCycle.prototype.toString = function() {
    var string = "";
    for (var i = 0; i < this.processedChecks.length; i++) {
      string += this.processedChecks[i].toString() + ", ";
    }
    return string;
  };

  window.FinanceCycle = FinanceCycle;

})(window, document);
