package db

import (
	"path/filepath"
	"testing"
)

func TestCheckSchema(t *testing.T) {
	if err := Init(filepath.Join(t.TempDir(), "vohive.db")); err != nil {
		t.Fatalf("initialize test database: %v", err)
	}
	if DB == nil {
		t.Fatal("database was not initialized")
	}

	if !DB.Migrator().HasTable(&Device{}) {
		t.Fatal("devices table was not created")
	}
	columns, err := DB.Migrator().ColumnTypes(&Device{})
	if err != nil {
		t.Fatalf("inspect devices schema: %v", err)
	}
	if len(columns) == 0 {
		t.Fatal("devices schema is empty")
	}
}
