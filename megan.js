(function(window, document, undefined) {
  /** Returns a unique transaction ID for the transactions. */
  var TransactionIdGenerator = (function () {
    var id = -1;
    return {
      getNextId: function() {
        id ++;
        return id;
      }
    };
  })();

  /** Quick hacky way of printing out a date string with readible format. */
  Date.prototype.toString = function() {
    return this.toISOString().slice(0, 10);
  };
  /** Quick hacky way of converting cents to readible dollar string. */
  Number.prototype.centsToDollars = function() {
    return (this/100).toFixed(2);
  };
  /** Quick hacky way to add space padding until the desired length of string. */
  String.prototype.addPadding = function(desiredLength) {
    var padding = Array(desiredLength).join(" ");
    return (this + padding).substring(0, desiredLength);
  };

  /** Represents a single check. */
  var Check = function(cents, date, details) {
    if (!Number.isInteger(cents) || cents < 0) {
      throw "Amount of check must be integer and can not < 0.";
    }
    this.transactionId = TransactionIdGenerator.getNextId();
    this.amount = cents;
    this.discretionaryIncome = this.amount;
    this.deductedAmount = 0;
    this.date = date;
    this.details = (details && details.length > 0) ? details : "An Awesome Paycheck";
  };
  Check.prototype.setDeductedAmount = function(deductedAmount) {
    if (!Number.isInteger(deductedAmount)) {
      throw "Deducted Amount must be integer.";
    }
    // DeductedAmount can be positive or negative. If negative, it means that we have previous
    // savings in the bank that we can distribute to this paycheck to increase discretionary income.
    this.deductedAmount = deductedAmount;
    this.discretionaryIncome = this.amount - this.deductedAmount;
  };
  Check.prototype.toString = function() {
    return this.date + " | $ " + this.amount.centsToDollars().addPadding(16) + " | " +
        this.details.addPadding(30) + " | $ " +
        this.discretionaryIncome.centsToDollars().addPadding(16);
  };

  /** Represents a single bill. */
  var Bill = function(cents, date, details) {
    if (!Number.isInteger(cents) || cents < 0) {
      throw "Amount of bill must be integer and can not < 0.";
    }
    this.transactionId = TransactionIdGenerator.getNextId();
    this.amount =  cents;
    this.date = date;
    this.details = (details && details.length > 0) ? details : "An Evil Bill";
  };
  Bill.prototype.toString = function() {
    return this.date + " | $ " + (-this.amount).centsToDollars().addPadding(16) + " | " +
        "Bill: " + this.details.addPadding(45);
  };

  /** Represents a goal. */
  var Goal = function(cents, date, details) {
    if (!Number.isInteger(cents) || cents < 0) {
      throw "Amount of goal must be integer and can not < 0.";
    }
    this.transactionId = TransactionIdGenerator.getNextId();
    this.amount =  cents;
    this.date = date;
    this.details = (details && details.length > 0) ? details : "A Happy Reachable Goal";
  };
  Goal.prototype.toString = function() {
    return this.date + " | $ " + (-this.amount).centsToDollars().addPadding(16) + " | " +
        "Goal: " + this.details.addPadding(45);
  };

  /**
   * Represents a particular financial cycle, given an array of mixed checks, bills and goals. We
   * will assume that sequence is already sorted by date.
   */
  var FinanceCycle = function(sequence) {
    this.process(sequence);
  };
  FinanceCycle.prototype.process = function(sequence) {
    this.sequence = sequence;
    this.checks = [];
    this.debtTable = [];
    var latestCheckIndex = -1;
    // Stores the checks in the sequence in a separate array for conveninece. Also calculates a
    // debt table which associates the bills/goals to the immediate paycheck before them.
    for (var i = 0; i < this.sequence.length; i++) {
      var element = this.sequence[i];
      if (element instanceof Check) {
        this.checks.push(element);
        element.setDeductedAmount(0);
        latestCheckIndex = this.checks.length - 1;
      } else if (element instanceof Bill || element instanceof Goal) {
        if (latestCheckIndex >= 0) {
          if (!this.debtTable[latestCheckIndex]) {
            this.debtTable[latestCheckIndex] = 0;
          }
          this.debtTable[latestCheckIndex] += element.amount;
        }
      } else {
        throw "Invalid format in finance cycle sequence.";
      }
    }
  };
  FinanceCycle.prototype.deductPaychecks = function() {
    // First, we try to pay out each bills and goals with the check immediately before them.
    for (var i = 0; i < this.checks.length; i++) {
      if (this.debtTable[i]) {
        this.checks[i].setDeductedAmount(this.debtTable[i]);
      }
    }
    // Now, we should try to even out the deduction so that we can get decent discretionary income
    // per pay check.

    // For a certain paycheck, the money you can move from previous paychecks to even up the
    // shortage of current paycheck is represented as distributableIncome.
    var distributableIncome = this.checks.reduce(function(sum, obj) {
      return sum + obj.discretionaryIncome;
    }, 0);
    // PendingDeduction is the money that we need to deduct from current or previous paychecks
    // in order to distribute to future paychecks that is short of money.
    var pendingDeduction = 0;
    for (var i = this.checks.length - 1; i >= 0; i--) {
      var expectedAverageDiscretionaryIncome = Math.round(distributableIncome / (i + 1));
      var currentCheck = this.checks[i];
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
      currentCheck.setDeductedAmount(currentCheck.deductedAmount - matchingDiff);
      pendingDeduction += (matchingDiff);
      distributableIncome -= currentCheck.discretionaryIncome;
    }
  };
  FinanceCycle.prototype.print = function() {
    // Prints a user friendly message to represent the finance cycle.
    console.log("Date       | Deposit/Withdrawal | Detailed Description           " +
        "| After deduction    | Total Savings for You / Bills");
    var savings = 0;
    var discretionary = 0;
    var varified = true;
    for (var i = 0; i < this.sequence.length; i++) {
      var item = this.sequence[i];
      if (item instanceof Check) {
        if (item.discretionaryIncome < 0) {
          varified = false;
        }
        savings += item.deductedAmount;
        discretionary += item.discretionaryIncome;
      } else {
        savings -= item.amount;
      }
      if (savings < 0) {
        varified = false;
      }
      console.log(item.toString() + " | $ " + discretionary.centsToDollars() + " / $ " +
          savings.centsToDollars());
    }
    if (varified) {
      console.log("\n\nCongrats! It looks like you will not be in debt!");
    } else {
      console.log("\n\nSorry, it seems that after deduction, you might still be in debt " +
          "sometimes. We will try to improve this.");
    }
  };

  window.Check = Check;
  window.Bill = Bill;
  window.Goal = Goal;
  window.FinanceCycle = FinanceCycle;

})(window, document);
