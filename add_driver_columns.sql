-- Add driver fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20);

-- Create index for driver_id
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
