-- Previous Desktop Pharmacy Application database backup dump
-- Generated: 2025-06-25 10:12:00
-- Version: V1 Desktop DB Engine

CREATE TABLE IF NOT EXISTS Medicines (
    LegId VARCHAR(50),
    DrugName VARCHAR(100),
    Generic VARCHAR(100),
    UPC VARCHAR(50),
    SKUCode VARCHAR(50),
    Price DECIMAL(10,2),
    Pack VARCHAR(50)
);

INSERT INTO Medicines (LegId, DrugName, Generic, UPC, SKUCode, Price, Pack) VALUES
('sql-med-1', 'Ciprofloxacin 500mg Tablet', 'Ciprofloxacin', 'CIP500SQL', 'SKU-CIP-SQL', 180.00, 'Box of 10'),
('sql-med-2', 'Metformin 500mg Tablet', 'Metformin', 'MET500SQL', 'SKU-MET-SQL', 90.00, 'Box of 30');

CREATE TABLE IF NOT EXISTS Customers (
    CustomerId VARCHAR(50),
    FullName VARCHAR(100),
    Phone VARCHAR(50),
    Address VARCHAR(100),
    Debt DECIMAL(10,2)
);

INSERT INTO Customers (CustomerId, FullName, Phone, Address, Debt) VALUES
('sql-cust-1', 'Mulugeta Wolde', '+251-91-9998887', 'Piazza, Addis Ababa', 450.00),
('sql-cust-2', 'Almaz Demeke', '+251-91-7776665', 'Megenagna, Addis Ababa', 0.00);
