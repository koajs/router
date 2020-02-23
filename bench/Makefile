all: middleware

middleware:
	@sh ./run 1 false
	@sh ./run 5 false
	@sh ./run 10 false
	@sh ./run 20 false
	@sh ./run 50 false
	@sh ./run 100 false
	@sh ./run 200 false
	@sh ./run 500 false
	@sh ./run 1000 false
	@sh ./run 1 true
	@sh ./run 5 true
	@sh ./run 10 true
	@sh ./run 20 true
	@sh ./run 50 true
	@sh ./run 100 true
	@sh ./run 200 true
	@sh ./run 500 true
	@sh ./run 1000 true

.PHONY: all middleware
